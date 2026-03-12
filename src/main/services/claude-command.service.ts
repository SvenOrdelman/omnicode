import { execFile } from 'child_process';
import { promisify } from 'util';
import type { ClaudeCliCommand, ClaudeCommandCatalog } from '../../shared/claude-command-types';

const execFileAsync = promisify(execFile);

const HELP_TIMEOUT_MS = 15_000;
const MAX_BUFFER_BYTES = 4 * 1024 * 1024;
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_DISCOVERY_DEPTH = 3;

type CommandCache = {
  expiresAt: number;
  catalog: ClaudeCommandCatalog;
};

type ParsedCommandEntry = {
  name: string;
  aliases: string[];
  usage: string;
  description: string;
};

let cache: CommandCache | null = null;
let inflight: Promise<ClaudeCommandCatalog> | null = null;
let topLevelNameCache: { expiresAt: number; names: Set<string> } | null = null;

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

async function runHelp(path: string[]): Promise<string> {
  const { stdout } = await execFileAsync(claudeBin(), [...path, '--help'], {
    env: claudeEnv(),
    timeout: HELP_TIMEOUT_MS,
    maxBuffer: MAX_BUFFER_BYTES,
  });
  return stdout;
}

function parseCommandEntries(helpOutput: string): ParsedCommandEntry[] {
  const lines = helpOutput.split(/\r?\n/);
  const commandsHeaderIndex = lines.findIndex((line) => line.trim() === 'Commands:');
  if (commandsHeaderIndex === -1) {
    return [];
  }

  const entries: ParsedCommandEntry[] = [];
  let index = commandsHeaderIndex + 1;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (!/^\s{2,}/.test(line)) {
      break;
    }

    const entryMatch = line.match(/^\s{2,}(.+?)\s{2,}(.+)$/);
    if (!entryMatch) {
      index += 1;
      continue;
    }

    const usage = entryMatch[1].trim();
    const descriptionParts = [entryMatch[2].trim()];
    let continuationIndex = index + 1;

    while (continuationIndex < lines.length) {
      const continuation = lines[continuationIndex];
      if (!continuation.trim()) {
        continuationIndex += 1;
        break;
      }

      if (/^\s{2,}.+?\s{2,}.+$/.test(continuation)) {
        break;
      }

      if (/^\s{20,}\S/.test(continuation)) {
        descriptionParts.push(continuation.trim());
        continuationIndex += 1;
        continue;
      }

      break;
    }

    index = continuationIndex;

    const commandToken = usage.split(/\s+/)[0] || '';
    const aliases = commandToken
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean);

    if (aliases.length === 0) {
      continue;
    }

    entries.push({
      name: aliases[0],
      aliases,
      usage,
      description: descriptionParts.join(' ').trim(),
    });
  }

  return entries;
}

function withCommandMetadata(path: string[], entry: ParsedCommandEntry, children: ClaudeCliCommand[]): ClaudeCliCommand {
  const commandPath = [...path, entry.name];
  return {
    name: entry.name,
    aliases: entry.aliases.slice(1),
    usage: entry.usage,
    description: entry.description,
    commandPath,
    command: `/${commandPath.join(' ')}`,
    requiresArguments: /<[^>]+>/.test(entry.usage),
    children,
  };
}

async function discoverCommands(path: string[], depth: number): Promise<ClaudeCliCommand[]> {
  const helpOutput = await runHelp(path);
  const entries = parseCommandEntries(helpOutput).filter((entry) => entry.name.toLowerCase() !== 'help');

  const commands: ClaudeCliCommand[] = [];

  for (const entry of entries) {
    let children: ClaudeCliCommand[] = [];
    if (depth + 1 < MAX_DISCOVERY_DEPTH) {
      try {
        children = await discoverCommands([...path, entry.name], depth + 1);
      } catch {
        children = [];
      }
    }

    commands.push(withCommandMetadata(path, entry, children));
  }

  return commands;
}

async function buildCatalog(): Promise<ClaudeCommandCatalog> {
  const commands = await discoverCommands([], 0);
  return {
    generatedAt: Date.now(),
    commands,
  };
}

export async function getClaudeCommandCatalog(forceRefresh = false): Promise<ClaudeCommandCatalog> {
  const now = Date.now();
  if (!forceRefresh && cache && cache.expiresAt > now) {
    return cache.catalog;
  }

  if (!inflight) {
    inflight = buildCatalog()
      .then((catalog) => {
        cache = {
          catalog,
          expiresAt: Date.now() + CACHE_TTL_MS,
        };
        return catalog;
      })
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}

export async function getTopLevelClaudeCommandNames(): Promise<Set<string>> {
  const now = Date.now();
  if (topLevelNameCache && topLevelNameCache.expiresAt > now) {
    return new Set(topLevelNameCache.names);
  }

  const helpOutput = await runHelp([]);
  const topLevelEntries = parseCommandEntries(helpOutput).filter((entry) => entry.name.toLowerCase() !== 'help');
  const names = new Set<string>();

  for (const entry of topLevelEntries) {
    for (const alias of entry.aliases) {
      names.add(alias.toLowerCase());
    }
  }

  topLevelNameCache = {
    names,
    expiresAt: now + CACHE_TTL_MS,
  };

  return new Set(names);
}
