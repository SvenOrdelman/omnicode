import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { getRemoteAutomationConfig, openRemoteAutomationUrl, normalizeAutomationUrl } from '../services/automation.service';

export function registerAutomationHandlers(): void {
  ipcMain.handle(IPC.AUTOMATIONS_GET_REMOTE_URL, async () => {
    return getRemoteAutomationConfig();
  });

  ipcMain.handle(IPC.AUTOMATIONS_OPEN_REMOTE, async (_, rawUrl?: string) => {
    const normalized = rawUrl ? normalizeAutomationUrl(rawUrl) : undefined;
    return openRemoteAutomationUrl(normalized);
  });
}
