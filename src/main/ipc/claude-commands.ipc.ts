import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { getClaudeCommandCatalog } from '../services/claude-command.service';

export function registerClaudeCommandHandlers(): void {
  ipcMain.handle(IPC.CLAUDE_COMMANDS_LIST, async (_, params?: { forceRefresh?: boolean }) => {
    return getClaudeCommandCatalog(Boolean(params?.forceRefresh));
  });
}
