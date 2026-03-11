import type { BrowserWindow } from 'electron';
import { chmodSync, existsSync, readdirSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { IPC } from '../../shared/ipc-channels';

// node-pty is loaded dynamically to handle cases where native module isn't built
let pty: any = null;

interface TerminalInstance {
  ptyProcess: any; // node-pty IPty
  shell: string;
}

const terminals = new Map<string, TerminalInstance>();

function ensureNodePtySpawnHelperExecutable(): void {
  if (process.platform === 'win32') return;

  try {
    const packageJsonPath = require.resolve('node-pty/package.json');
    const prebuildsDir = path.join(path.dirname(packageJsonPath), 'prebuilds');
    if (!isDirectory(prebuildsDir)) return;

    const prebuildDirs = readdirSync(prebuildsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    for (const prebuildDir of prebuildDirs) {
      const helperPath = path.join(prebuildsDir, prebuildDir, 'spawn-helper');
      if (!existsSync(helperPath)) continue;

      const mode = statSync(helperPath).mode & 0o777;
      if ((mode & 0o111) === 0) {
        chmodSync(helperPath, mode | 0o111);
        console.warn(`Adjusted node-pty helper permissions: ${helperPath}`);
      }
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`Unable to verify node-pty helper permissions (${reason})`);
  }
}

function isDirectory(targetPath: string | undefined): targetPath is string {
  if (!targetPath) return false;

  try {
    return statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function resolveCwd(requestedCwd: string): string {
  if (isDirectory(requestedCwd)) return requestedCwd;

  const fallbacks = [process.cwd(), os.homedir(), '/'];
  const fallback = fallbacks.find(isDirectory);

  if (!fallback) {
    return process.cwd();
  }

  if (requestedCwd) {
    console.warn(`Terminal cwd "${requestedCwd}" is invalid, falling back to "${fallback}"`);
  }

  return fallback;
}

function shellExists(shellPath: string): boolean {
  if (!shellPath) return false;
  if (!path.isAbsolute(shellPath)) return true;
  return existsSync(shellPath);
}

function getShellCandidates(): string[] {
  const candidates =
    process.platform === 'win32'
      ? [process.env.COMSPEC, 'powershell.exe', 'cmd.exe']
      : [process.env.SHELL, '/bin/zsh', '/bin/bash', '/bin/sh'];

  return Array.from(new Set(candidates.filter((value): value is string => Boolean(value && shellExists(value)))));
}

function getSpawnEnv(shell: string): Record<string, string> {
  const envEntries = Object.entries(process.env).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string'
  );
  const env = Object.fromEntries(envEntries);

  if (process.platform !== 'win32') {
    env.SHELL = shell;
  }

  return env;
}

async function loadPty() {
  if (!pty) {
    try {
      ensureNodePtySpawnHelperExecutable();
      const imported = await import('node-pty');
      pty = (imported as any).spawn ? imported : (imported as any).default;

      if (!pty?.spawn) {
        throw new Error('node-pty loaded without a spawn export');
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`node-pty not available - terminal features disabled (${reason})`);
      pty = null;
    }
  }
  return pty;
}

export async function createTerminal(
  id: string,
  cwd: string,
  window: BrowserWindow
): Promise<boolean> {
  const nodePty = await loadPty();
  if (!nodePty) return false;

  const resolvedCwd = resolveCwd(cwd);
  const shells = getShellCandidates();
  const shellList = shells.length > 0 ? shells : process.platform === 'win32' ? ['powershell.exe'] : ['/bin/sh'];

  let ptyProcess: any = null;
  let shell = shellList[0];
  let lastError: unknown = null;

  for (const candidateShell of shellList) {
    try {
      ptyProcess = nodePty.spawn(candidateShell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: resolvedCwd,
        env: getSpawnEnv(candidateShell),
      });
      shell = candidateShell;
      break;
    } catch (error) {
      lastError = error;
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(
        `Failed to spawn terminal shell "${candidateShell}" in "${resolvedCwd}" (${reason})`
      );
    }
  }

  if (!ptyProcess) {
    const reason = lastError instanceof Error ? lastError.message : String(lastError);
    console.error(`Unable to create terminal "${id}" (${reason})`);
    return false;
  }

  ptyProcess.onData((data: string) => {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC.TERMINAL_DATA, { id, data });
    }
  });

  ptyProcess.onExit(() => {
    terminals.delete(id);
  });

  terminals.set(id, { ptyProcess, shell });
  return true;
}

export function writeTerminal(id: string, data: string): void {
  const term = terminals.get(id);
  if (term) {
    term.ptyProcess.write(data);
  }
}

export function resizeTerminal(id: string, cols: number, rows: number): void {
  const term = terminals.get(id);
  if (term) {
    term.ptyProcess.resize(cols, rows);
  }
}

export function closeTerminal(id: string): void {
  const term = terminals.get(id);
  if (term) {
    term.ptyProcess.kill();
    terminals.delete(id);
  }
}

export function closeAllTerminals(): void {
  for (const [id] of terminals) {
    closeTerminal(id);
  }
}
