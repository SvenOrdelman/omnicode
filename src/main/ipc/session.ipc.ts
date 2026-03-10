import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import {
  addMessage,
  createSession,
  setSessionArchived,
  listSessions,
  getSession,
  deleteSession,
  getMessages,
} from '../services/session.service';
import type { ProviderContent } from '../../shared/provider-types';

export function registerSessionHandlers(): void {
  ipcMain.handle(IPC.SESSION_CREATE, async (_, { projectId, provider }) => {
    return createSession(projectId, provider);
  });

  ipcMain.handle(IPC.SESSION_LIST, async (_, { projectId, includeArchived }: { projectId: string; includeArchived?: boolean }) => {
    return listSessions(projectId, includeArchived ?? false);
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

  ipcMain.handle(
    IPC.SESSION_ADD_MESSAGE,
    async (
      _,
      {
        sessionId,
        role,
        content,
      }: { sessionId: string; role: 'user' | 'assistant' | 'system' | 'tool'; content: ProviderContent[] }
    ) => {
      const message = addMessage(sessionId, role, content);
      const session = getSession(sessionId);
      return { message, session };
    }
  );

  ipcMain.handle(IPC.SESSION_ARCHIVE, async (_, { sessionId, archived }: { sessionId: string; archived: boolean }) => {
    setSessionArchived(sessionId, archived);
    return { ok: true };
  });
}
