import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import {
  createSession,
  listSessions,
  getSession,
  deleteSession,
  getMessages,
} from '../services/session.service';

export function registerSessionHandlers(): void {
  ipcMain.handle(IPC.SESSION_CREATE, async (_, { projectId, provider }) => {
    return createSession(projectId, provider);
  });

  ipcMain.handle(IPC.SESSION_LIST, async (_, projectId: string) => {
    return listSessions(projectId);
  });

  ipcMain.handle(IPC.SESSION_GET, async (_, sessionId: string) => {
    const session = getSession(sessionId);
    if (!session) return null;
    const messages = getMessages(sessionId);
    return { session, messages };
  });

  ipcMain.handle(IPC.SESSION_DELETE, async (_, sessionId: string) => {
    deleteSession(sessionId);
    return { ok: true };
  });
}
