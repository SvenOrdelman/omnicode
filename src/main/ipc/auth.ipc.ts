import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import {
  getAuthStatus,
  loginWithCli,
  logoutCli,
  cancelLogin,
} from '../services/auth.service';
import { providerRegistry } from '../providers/registry';

export function registerAuthHandlers(): void {
  ipcMain.handle(IPC.AUTH_STATUS, async () => {
    const status = await getAuthStatus();
    // Keep provider in sync
    const claude = providerRegistry.get('claude');
    if (claude) {
      if (status.authenticated) {
        claude.configure({});
      }
    }
    return status;
  });

  ipcMain.handle(IPC.AUTH_LOGIN, async () => {
    const result = await loginWithCli();
    if (result.success) {
      // Configure provider after successful login
      const claude = providerRegistry.get('claude');
      if (claude) {
        claude.configure({});
      }
    }
    return result;
  });

  ipcMain.handle(IPC.AUTH_LOGOUT, async () => {
    return logoutCli();
  });

  ipcMain.handle(IPC.AUTH_CANCEL_LOGIN, async () => {
    cancelLogin();
    return { ok: true };
  });
}
