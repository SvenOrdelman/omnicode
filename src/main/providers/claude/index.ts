import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { shell } from 'electron';
import { promisify } from 'util';
import type { Options, PermissionMode } from '@anthropic-ai/claude-agent-sdk';
import type { ILLMProvider, ProviderConfig, SendPromptOptions } from '../types';
import { adaptSdkMessage, createUserMessage } from './message-adapter';
import { cancelAllApprovals, createApprovalRequest } from './permission-handler';
import { addMessage, updateSession } from '../../services/session.service';
import { getClaudeCommandCatalog, getTopLevelClaudeCommandNames } from '../../services/claude-command.service';
import type { ClaudeCliCommand, ClaudeCommandCatalog } from '../../../shared/claude-command-types';
import type { AgentMode, ChatExecutionMode } from '../../../shared/chat-types';
import type { ProviderMessage } from '../../../shared/provider-types';

const execFileAsync = promisify(execFile);
const MAX_CLAUDE_OUTPUT_BUFFER = 4 * 1024 * 1024;
const CLI_COMMAND_TIMEOUT_MS = 30_000;

type McpStatus = {
  name: string;
  status: 'connected' | 'failed' | 'needs-auth' | 'pending' | 'disabled';
  error?: string;
  scope?: string;
  config?: Record<string, unknown>;
};

function claudeBin(): string {
  return process.env.CLAUDE_BIN || 'claude';
}

function claudeEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: [
      process.env.PATH,
      '/usr/local/bin',
      '/opt/homebrew/bin',
      `${process.env.HOME}/.local/bin`,
      `${process.env.HOME}/.npm-global/bin`,
    ]
      .filter(Boolean)
      .join(':'),
  };
}

function tokenizeArgs(raw: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (const char of raw) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\' && quote !== "'") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (escaped) {
    current += '\\';
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

async function waitForDecision(pending: Promise<boolean>, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const decisionTimeout = setTimeout(() => finish(false), 5 * 60 * 1000);

    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      clearTimeout(decisionTimeout);
      resolve(value);
    };

    const onAbort = () => {
      // Intentionally no-op: Claude may abort the request signal before the
      // approval click reaches us. We still wait for explicit user approval.
    };

    if (!signal.aborted) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    pending.then((approved) => finish(approved)).catch(() => finish(false));
  });
}

function createAssistantTextMessage(text: string): ProviderMessage {
  return {
    id: randomUUID(),
    role: 'assistant',
    content: [{ type: 'text', text }],
    timestamp: Date.now(),
  };
}

function summarizePermissionReason(decisionReason?: string, blockedPath?: string): string {
  const segments: string[] = [];
  if (decisionReason) {
    segments.push(decisionReason);
  }
  if (blockedPath) {
    segments.push(`Blocked path: ${blockedPath}`);
  }
  return segments.join(' ');
}

function safeTrim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stripAnsi(input: string): string {
  let output = '';
  let index = 0;

  while (index < input.length) {
    const code = input.charCodeAt(index);
    if (code !== 27) {
      output += input[index];
      index += 1;
      continue;
    }

    const next = input[index + 1];

    // CSI sequence: ESC [ ... final-byte
    if (next === '[') {
      index += 2;
      while (index < input.length) {
        const finalByte = input.charCodeAt(index);
        index += 1;
        if (finalByte >= 64 && finalByte <= 126) {
          break;
        }
      }
      continue;
    }

    // OSC sequence: ESC ] ... BEL or ESC \
    if (next === ']') {
      index += 2;
      while (index < input.length) {
        const charCode = input.charCodeAt(index);
        if (charCode === 7) {
          index += 1;
          break;
        }
        if (charCode === 27 && input[index + 1] === '\\') {
          index += 2;
          break;
        }
        index += 1;
      }
      continue;
    }

    // Unknown escape sequence.
    index += 1;
  }

  return output;
}

function normalizeOutput(raw: string): string {
  return stripAnsi(raw)
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function mdEscape(text: string): string {
  return text.replace(/[|<>]/g, '').replace(/\s+/g, ' ').trim();
}

function commandLink(command: string, label: string): string {
  return `[${label}](command://${encodeURIComponent(command)})`;
}

function resolvePermissionMode(mode?: AgentMode, executionMode?: ChatExecutionMode): PermissionMode {
  if (mode === 'plan') return 'plan';
  if (executionMode) return executionMode;
  return 'default';
}

function resolveTools(mode?: AgentMode): Options['tools'] | undefined {
  if (mode === 'chat') {
    return [];
  }
  return undefined;
}

function isEditTool(toolName: string): boolean {
  const normalized = toolName.trim().toLowerCase();
  if (!normalized) return false;

  if (normalized === 'edit' || normalized === 'write' || normalized === 'multiedit') {
    return true;
  }

  return normalized.includes('edit') || normalized.includes('write');
}

function isRiskyToolForAutoEdits(toolName: string): boolean {
  const normalized = toolName.trim().toLowerCase();
  if (!normalized) return true;

  // Shell/command execution should still require approval in auto-edit mode.
  if (
    normalized === 'bash' ||
    normalized.includes('bash') ||
    normalized.includes('shell') ||
    normalized.includes('terminal') ||
    normalized.includes('exec') ||
    normalized.includes('command')
  ) {
    return true;
  }

  // MCP operations can perform side effects outside the repo context.
  if (normalized.startsWith('mcp')) {
    return true;
  }

  return false;
}

function toolApprovalFingerprint(toolName: string, input: Record<string, unknown>): string {
  let serializedInput = '';
  try {
    serializedInput = JSON.stringify(input);
  } catch {
    serializedInput = '[unserializable-input]';
  }
  return `${toolName.trim().toLowerCase()}::${serializedInput}`;
}

// Active abort controllers per session for interruption
const activeControllers = new Map<string, AbortController>();

export class ClaudeProvider implements ILLMProvider {
  readonly id = 'claude';
  readonly displayName = 'Claude (Anthropic)';

  private configured = false;
  private model = 'claude-sonnet-4-6';

  configure(config: ProviderConfig): void {
    this.configured = true;
    if (config.model) this.model = config.model;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  private async createMcpQuery(cwd: string): Promise<any> {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
    return query({
      prompt: '',
      options: {
        cwd,
        model: this.model,
        settingSources: ['user', 'project', 'local'],
      },
    });
  }

  private commandMatches(command: ClaudeCliCommand, token: string): boolean {
    const normalized = token.toLowerCase();
    if (command.name.toLowerCase() === normalized) {
      return true;
    }
    return command.aliases.some((alias) => alias.toLowerCase() === normalized);
  }

  private findMatchedCommand(
    commands: ClaudeCliCommand[],
    args: string[]
  ): ClaudeCliCommand | null {
    let current = commands;
    let matched: ClaudeCliCommand | null = null;

    for (const token of args) {
      if (token.startsWith('-')) {
        break;
      }

      const next = current.find((command) => this.commandMatches(command, token));
      if (!next) {
        break;
      }

      matched = next;
      current = next.children;
    }

    return matched;
  }

  private renderCommandActions(catalog: ClaudeCommandCatalog, args: string[]): string {
    if (args.length === 0) {
      return '';
    }

    const matched = this.findMatchedCommand(catalog.commands, args);
    if (!matched) {
      return '';
    }

    const actionLinks: string[] = [];
    const invokedCommand = `/${args.join(' ')}`.trim();
    const canonicalCommand = `/${matched.commandPath.join(' ')}`;
    actionLinks.push(commandLink(invokedCommand, 'Run again'));
    actionLinks.push(commandLink(`${canonicalCommand} --help`, 'Help'));

    const lines: string[] = [];
    lines.push('### Command Actions');
    lines.push('');
    lines.push(actionLinks.join(' · '));

    if (matched.children.length > 0) {
      const subcommands = [...matched.children]
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 12)
        .map((command) => {
          if (command.requiresArguments) {
            return commandLink(`${command.command} --help`, `${command.command} (help)`);
          }
          return commandLink(command.command, command.command);
        });
      lines.push('');
      lines.push(`Subcommands: ${subcommands.join(' · ')}`);
      if (matched.children.length > 12) {
        lines.push(`(showing 12/${matched.children.length})`);
      }
    }

    return lines.join('\n');
  }

  private maybeAppendCommandActions(output: string, args: string[], catalog: ClaudeCommandCatalog | null): string {
    if (!catalog) {
      return output;
    }
    const actions = this.renderCommandActions(catalog, args);
    if (!actions) {
      return output;
    }
    return `${output}\n\n${actions}`;
  }

  private async isKnownTopLevelCommand(commandName: string, catalog: ClaudeCommandCatalog | null): Promise<boolean> {
    if (catalog) {
      return catalog.commands.some((command) => this.commandMatches(command, commandName));
    }

    const topLevelCommands = await getTopLevelClaudeCommandNames().catch(() => null);
    if (!topLevelCommands) {
      return false;
    }
    return topLevelCommands.has(commandName);
  }

  private formatMcpConfig(config: Record<string, unknown> | undefined): string {
    if (!config) {
      return '-';
    }

    const type = safeTrim(config.type);
    const url = safeTrim((config as { url?: unknown }).url);
    const command = safeTrim((config as { command?: unknown }).command);
    const args = Array.isArray((config as { args?: unknown[] }).args)
      ? ((config as { args?: unknown[] }).args as unknown[])
          .filter((value): value is string => typeof value === 'string')
          .join(' ')
      : '';
    const sdkName = safeTrim((config as { name?: unknown }).name);

    if (url) {
      return mdEscape(url);
    }

    if (command) {
      return mdEscape(`${command}${args ? ` ${args}` : ''}`);
    }

    if (type === 'sdk' && sdkName) {
      return mdEscape(`sdk:${sdkName}`);
    }

    return mdEscape(type || 'unknown');
  }

  private statusLabel(status: McpStatus['status']): string {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'needs-auth':
        return 'Needs auth';
      case 'failed':
        return 'Failed';
      case 'pending':
        return 'Pending';
      case 'disabled':
        return 'Disabled';
      default:
        return status;
    }
  }

  private renderMcpStatusMarkdown(statuses: McpStatus[]): string {
    if (statuses.length === 0) {
      return 'No MCP servers configured.';
    }

    const lines: string[] = [];
    lines.push('### MCP Servers');
    lines.push('');
    lines.push('| Server | Status | Source | Actions |');
    lines.push('| --- | --- | --- | --- |');

    for (const status of statuses) {
      const quoted = JSON.stringify(status.name);
      const actions: string[] = [];
      actions.push(commandLink(`/mcp get ${quoted}`, 'Details'));

      if (status.status === 'needs-auth') {
        actions.push(commandLink(`/mcp reauth ${quoted}`, 'Reauthenticate'));
      }

      if (status.status === 'failed' || status.status === 'pending' || status.status === 'needs-auth') {
        actions.push(commandLink(`/mcp reconnect ${quoted}`, 'Reconnect'));
      }

      if (status.status === 'disabled') {
        actions.push(commandLink(`/mcp enable ${quoted}`, 'Enable'));
      } else {
        actions.push(commandLink(`/mcp disable ${quoted}`, 'Disable'));
      }

      lines.push(
        `| ${mdEscape(status.name)} | ${this.statusLabel(status.status)} | ${this.formatMcpConfig(status.config)} | ${actions.join(
          ' · '
        )} |`
      );

      if (status.error) {
        lines.push(`|  |  | Error | ${mdEscape(status.error)} |`);
      }
    }

    lines.push('');
    lines.push(commandLink('/mcp', 'Refresh'));
    return lines.join('\n');
  }

  private async getMcpStatusMarkdown(cwd: string): Promise<string> {
    let mcpQuery: any | null = null;
    try {
      mcpQuery = await this.createMcpQuery(cwd);
      const statuses = (await mcpQuery.mcpServerStatus()) as McpStatus[];
      return this.renderMcpStatusMarkdown(statuses);
    } catch (error: unknown) {
      return `Could not read MCP status: ${String(error)}`;
    } finally {
      mcpQuery?.close?.();
    }
  }

  private async executeClaudeCommand(args: string[], cwd: string): Promise<string> {
    try {
      const { stdout, stderr } = await execFileAsync(claudeBin(), args, {
        cwd,
        env: claudeEnv(),
        timeout: CLI_COMMAND_TIMEOUT_MS,
        maxBuffer: MAX_CLAUDE_OUTPUT_BUFFER,
      });

      const output = normalizeOutput([stdout, stderr].filter(Boolean).join('\n'));
      return output || 'Command completed with no output.';
    } catch (error: unknown) {
      const withStreams = error as { stdout?: unknown; stderr?: unknown; message?: unknown };
      const stdout = normalizeOutput(safeTrim(withStreams.stdout));
      const stderr = normalizeOutput(safeTrim(withStreams.stderr));
      const details = [stdout, stderr].filter(Boolean).join('\n').trim();
      return details
        ? `Command failed.\n${details}`
        : `Command failed: ${String(withStreams.message || error)}`;
    }
  }

  private async runMcpAction(action: string, serverName: string, cwd: string): Promise<string> {
    let mcpQuery: any | null = null;
    try {
      mcpQuery = await this.createMcpQuery(cwd);

      if (action === 'reauth' || action === 'authenticate') {
        await mcpQuery.mcpAuthenticate(serverName);
      } else if (action === 'reconnect') {
        await mcpQuery.reconnectMcpServer(serverName);
      } else if (action === 'enable') {
        await mcpQuery.toggleMcpServer(serverName, true);
      } else if (action === 'disable') {
        await mcpQuery.toggleMcpServer(serverName, false);
      } else if (action === 'clear-auth') {
        await mcpQuery.mcpClearAuth(serverName);
      } else {
        return `Unsupported MCP action: ${action}`;
      }

      const title = action === 'reauth' ? 'Reauthentication requested.' : `${action} completed.`;
      const statuses = (await mcpQuery.mcpServerStatus()) as McpStatus[];
      return `${title}\n\n${this.renderMcpStatusMarkdown(statuses)}`;
    } catch (error: unknown) {
      return `MCP action failed: ${String(error)}\n\n${await this.getMcpStatusMarkdown(cwd)}`;
    } finally {
      mcpQuery?.close?.();
    }
  }

  private async runCliCommand(prompt: string, cwd: string): Promise<string | null> {
    const trimmed = prompt.trim();
    if (!trimmed.startsWith('/')) {
      return null;
    }

    const commandTail = trimmed.slice(1).trim();
    const args = tokenizeArgs(commandTail);
    if (args.length === 0) {
      return null;
    }

    const commandName = args[0].toLowerCase();
    const commandCatalog = await getClaudeCommandCatalog().catch(() => null);

    const execArgs = [...args];
    if (commandName === 'mcp') {
      const mcpAction = execArgs[1]?.toLowerCase();

      if (!mcpAction || mcpAction === 'list') {
        const status = await this.getMcpStatusMarkdown(cwd);
        return this.maybeAppendCommandActions(status, args, commandCatalog);
      }

      if (['reauth', 'authenticate', 'reconnect', 'enable', 'disable', 'clear-auth'].includes(mcpAction)) {
        const serverName = execArgs.slice(2).join(' ').trim();
        if (!serverName) {
          return 'Missing server name. Example: `/mcp reauth "My Server"`';
        }
        const result = await this.runMcpAction(mcpAction, serverName, cwd);
        return this.maybeAppendCommandActions(result, args, commandCatalog);
      }
    }

    const knownTopLevelCommand = await this.isKnownTopLevelCommand(commandName, commandCatalog);
    if (!knownTopLevelCommand) {
      return null;
    }

    const output = await this.executeClaudeCommand(execArgs, cwd);
    return this.maybeAppendCommandActions(output, args, commandCatalog);
  }

  async sendPrompt(options: SendPromptOptions): Promise<void> {
    if (!this.configured) {
      options.onError(new Error('Claude is not authenticated. Please log in first.'));
      return;
    }

    const { sessionId, prompt, cwd, sdkSessionId, model, mode, executionMode, onMessage, onEnd, onError } = options;
    const resolvedModel = safeTrim(model) || this.model;
    const resolvedPermissionMode = resolvePermissionMode(mode, executionMode);
    const resolvedTools = resolveTools(mode);

    // Store user message
    const userMsg = createUserMessage(prompt);
    onMessage(userMsg);
    addMessage(sessionId, 'user', userMsg.content);

    const localCommandOutput = await this.runCliCommand(prompt, cwd);
    if (localCommandOutput !== null) {
      const response = createAssistantTextMessage(localCommandOutput);
      onMessage(response);
      addMessage(sessionId, response.role, response.content);
      onEnd();
      return;
    }

    const controller = new AbortController();
    activeControllers.set(sessionId, controller);
    const decisionByToolUseId = new Map<string, boolean>();
    const decisionByFingerprint = new Map<string, boolean>();

    try {
      // Dynamic import to avoid issues before configuration
      const { query } = await import('@anthropic-ai/claude-agent-sdk');

      const canUseTool: Options['canUseTool'] =
        resolvedPermissionMode === 'plan'
          ? undefined
          : async (
              toolName: string,
              input: Record<string, unknown>,
              permissionContext: {
                signal: AbortSignal;
                decisionReason?: string;
                blockedPath?: string;
                toolUseID: string;
              }
            ) => {
              const fingerprint = toolApprovalFingerprint(toolName, input);
              if (decisionByToolUseId.has(permissionContext.toolUseID)) {
                const approved = decisionByToolUseId.get(permissionContext.toolUseID) === true;
                if (approved) {
                  return { behavior: 'allow', toolUseID: permissionContext.toolUseID };
                }
                return {
                  behavior: 'deny',
                  message: 'User denied this tool request.',
                  toolUseID: permissionContext.toolUseID,
                };
              }

              if (decisionByFingerprint.get(fingerprint) === true) {
                decisionByToolUseId.set(permissionContext.toolUseID, true);
                return { behavior: 'allow', toolUseID: permissionContext.toolUseID };
              }

              if (resolvedPermissionMode === 'bypassPermissions') {
                decisionByToolUseId.set(permissionContext.toolUseID, true);
                decisionByFingerprint.set(fingerprint, true);
                return { behavior: 'allow', toolUseID: permissionContext.toolUseID };
              }

              if (resolvedPermissionMode === 'dontAsk') {
                decisionByToolUseId.set(permissionContext.toolUseID, false);
                return {
                  behavior: 'deny',
                  message: 'Execution mode set to "No prompts". Tool execution denied.',
                  toolUseID: permissionContext.toolUseID,
                };
              }

              if (resolvedPermissionMode === 'acceptEdits') {
                if (isEditTool(toolName) || !isRiskyToolForAutoEdits(toolName)) {
                  decisionByToolUseId.set(permissionContext.toolUseID, true);
                  decisionByFingerprint.set(fingerprint, true);
                  return { behavior: 'allow', toolUseID: permissionContext.toolUseID };
                }
              }

              const { request, promise } = createApprovalRequest(
                sessionId,
                toolName,
                input,
                summarizePermissionReason(permissionContext.decisionReason, permissionContext.blockedPath)
              );
              options.onApprovalRequest(request);

              const approved = await waitForDecision(promise, permissionContext.signal);
              if (approved) {
                decisionByToolUseId.set(permissionContext.toolUseID, true);
                decisionByFingerprint.set(fingerprint, true);
                return { behavior: 'allow', toolUseID: permissionContext.toolUseID };
              }

              decisionByToolUseId.set(permissionContext.toolUseID, false);
              return {
                behavior: 'deny',
                message: 'User denied this tool request.',
                toolUseID: permissionContext.toolUseID,
              };
            };

      const queryOptions: Options = {
        cwd,
        permissionMode: resolvedPermissionMode,
        model: resolvedModel,
        ...(resolvedTools !== undefined ? { tools: resolvedTools } : {}),
        ...(resolvedPermissionMode === 'bypassPermissions'
          ? { allowDangerouslySkipPermissions: true }
          : {}),
        ...(canUseTool ? { canUseTool } : {}),
        includePartialMessages: true,
        settingSources: ['user', 'project', 'local'],
        onElicitation: async (
          request: {
            serverName: string;
            message: string;
            mode?: 'form' | 'url';
            url?: string;
            requestedSchema?: Record<string, unknown>;
          },
          elicitationOptions: { signal: AbortSignal }
        ) => {
          const isUrlElicitation = request.mode === 'url' || Boolean(request.url);
          const description = isUrlElicitation
            ? 'MCP server requested browser authentication.'
            : 'MCP server requested form input.';
          const toolInput: Record<string, unknown> = {
            serverName: request.serverName,
            message: request.message,
            mode: request.mode || (isUrlElicitation ? 'url' : 'form'),
          };

          if (request.url) {
            toolInput.url = request.url;
          }
          if (request.requestedSchema) {
            toolInput.requestedSchema = request.requestedSchema;
          }

          const { request: approvalRequest, promise } = createApprovalRequest(
            sessionId,
            `MCP (${request.serverName})`,
            toolInput,
            description
          );
          options.onApprovalRequest(approvalRequest);

          const approved = await waitForDecision(promise, elicitationOptions.signal);
          if (!approved) {
            return { action: 'decline' as const };
          }

          if (isUrlElicitation && request.url) {
            await shell.openExternal(request.url).catch(() => undefined);
            return { action: 'accept' as const };
          }

          const requiredFields = Array.isArray(request.requestedSchema?.required)
            ? request.requestedSchema?.required.filter((value): value is string => typeof value === 'string')
            : [];

          if (requiredFields.length === 0) {
            return { action: 'accept' as const, content: {} };
          }

          return { action: 'decline' as const };
        },
      };

      // Resume existing session if we have an SDK session ID
      if (sdkSessionId) {
        queryOptions.resume = sdkSessionId;
      }

      const generator = query({ prompt, options: queryOptions });
      let lastAssistantText: string | null = null;

      for await (const message of generator) {
        if (controller.signal.aborted) break;

        // Capture SDK session ID from init message
        if (message.type === 'system' && (message as any).subtype === 'init') {
          const newSdkSessionId = (message as any).session_id;
          if (newSdkSessionId) {
            updateSession(sessionId, { sdkSessionId: newSdkSessionId });
          }
        }

        const normalized = adaptSdkMessage(message);
        if (normalized) {
          if (
            message.type === 'result' &&
            typeof (message as any).result === 'string' &&
            lastAssistantText &&
            (message as any).result.trim() === lastAssistantText.trim()
          ) {
            continue;
          }

          onMessage(normalized);
          if (normalized.role !== 'tool') {
            addMessage(sessionId, normalized.role, normalized.content);
          }

          if (normalized.role === 'assistant') {
            const assistantText = normalized.content
              .map((block) => {
                if (block.type === 'text') return block.text;
                if (block.type === 'code') return block.code;
                return '';
              })
              .join('\n')
              .trim();

            if (assistantText) {
              lastAssistantText = assistantText;
            }
          }
        }
      }

      onEnd();
    } catch (err: unknown) {
      if (!controller.signal.aborted) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      cancelAllApprovals(sessionId);
      activeControllers.delete(sessionId);
    }
  }

  interrupt(sessionId: string): void {
    const controller = activeControllers.get(sessionId);
    if (controller) {
      controller.abort();
      cancelAllApprovals(sessionId);
      activeControllers.delete(sessionId);
    }
  }
}
