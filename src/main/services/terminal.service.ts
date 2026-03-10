import type { BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc-channels';

// node-pty is loaded dynamically to handle cases where native module isn't built
let pty: any = null;

interface TerminalInstance {
  ptyProcess: any; // node-pty IPty
  shell: string;
}

const terminals = new Map<string, TerminalInstance>();

async function loadPty() {
  if (!pty) {
    try {
      // @ts-ignore - optional native dep
      pty = await import('node-pty');
    } catch {
      console.warn('node-pty not available - terminal features disabled');
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

  const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/zsh';

  const ptyProcess = nodePty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd,
    env: process.env as Record<string, string>,
  });

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
