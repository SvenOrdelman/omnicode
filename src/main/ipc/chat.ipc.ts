import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { providerRegistry } from '../providers/registry';
import type { ProviderMessage } from '../../shared/provider-types';

export function registerChatHandlers(): void {
  ipcMain.handle(
    IPC.CHAT_SEND_PROMPT,
    async (event, { sessionId, prompt, cwd, sdkSessionId, providerId }) => {
      const provider = providerRegistry.get(providerId || 'claude');
      if (!provider) throw new Error(`Provider not found: ${providerId}`);
      if (!provider.isConfigured()) throw new Error('Provider not configured. Please set your API key.');

      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) throw new Error('Window not found');

      provider.sendPrompt({
        sessionId,
        prompt,
        cwd,
        sdkSessionId,
        onMessage: (message: ProviderMessage) => {
          if (!window.isDestroyed()) {
            window.webContents.send(IPC.CHAT_STREAM_MESSAGE, { sessionId, message });
          }
        },
        onDelta: (delta) => {
          if (!window.isDestroyed()) {
            window.webContents.send(IPC.CHAT_STREAM_MESSAGE, { sessionId, delta });
          }
        },
        onApprovalRequest: (request) => {
          if (!window.isDestroyed()) {
            window.webContents.send(IPC.APPROVAL_REQUEST, request);
          }
        },
        onEnd: () => {
          if (!window.isDestroyed()) {
            window.webContents.send(IPC.CHAT_STREAM_END, { sessionId });
          }
        },
        onError: (error) => {
          if (!window.isDestroyed()) {
            window.webContents.send(IPC.CHAT_STREAM_ERROR, {
              sessionId,
              error: error.message,
            });
          }
        },
      });

      return { ok: true };
    }
  );

  ipcMain.handle(IPC.CHAT_INTERRUPT, async (_, { sessionId, providerId }) => {
    const provider = providerRegistry.get(providerId || 'claude');
    provider?.interrupt(sessionId);
    return { ok: true };
  });
}
