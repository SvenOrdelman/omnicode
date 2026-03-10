import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { createTerminal, writeTerminal, resizeTerminal, closeTerminal } from '../services/terminal.service';

export function registerTerminalHandlers(): void {
  ipcMain.handle(IPC.TERMINAL_CREATE, async (event, { id, cwd }) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return false;
    return createTerminal(id, cwd, window);
  });

  ipcMain.handle(IPC.TERMINAL_WRITE, async (_, { id, data }) => {
    writeTerminal(id, data);
  });

  ipcMain.handle(IPC.TERMINAL_RESIZE, async (_, { id, cols, rows }) => {
    resizeTerminal(id, cols, rows);
  });

  ipcMain.handle(IPC.TERMINAL_CLOSE, async (_, { id }) => {
    closeTerminal(id);
  });
}
