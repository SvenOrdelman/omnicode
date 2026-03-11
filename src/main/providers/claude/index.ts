import type { ILLMProvider, ProviderConfig, SendPromptOptions } from '../types';
import { adaptSdkMessage, createUserMessage } from './message-adapter';
import { cancelAllApprovals } from './permission-handler';
import { updateSession } from '../../services/session.service';
import { addMessage } from '../../services/session.service';

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

  async sendPrompt(options: SendPromptOptions): Promise<void> {
    if (!this.configured) {
      options.onError(new Error('Claude is not authenticated. Please log in first.'));
      return;
    }

    const { sessionId, prompt, cwd, sdkSessionId, onMessage, onEnd, onError } = options;

    // Store user message
    const userMsg = createUserMessage(prompt);
    onMessage(userMsg);
    addMessage(sessionId, 'user', userMsg.content);

    const controller = new AbortController();
    activeControllers.set(sessionId, controller);

    try {
      // Dynamic import to avoid issues before configuration
      const { query } = await import('@anthropic-ai/claude-agent-sdk');

      const queryOptions: any = {
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
        cwd,
        permissionMode: 'default',
        model: this.model,
        includePartialMessages: true,
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
    } catch (err: any) {
      if (!controller.signal.aborted) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
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
