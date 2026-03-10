import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels';

const api = {
  // Chat
  sendPrompt: (params: {
    sessionId: string;
    prompt: string;
    cwd: string;
    sdkSessionId?: string;
    providerId?: string;
  }) => ipcRenderer.invoke(IPC.CHAT_SEND_PROMPT, params),
  interrupt: (params: { sessionId: string; providerId?: string }) =>
    ipcRenderer.invoke(IPC.CHAT_INTERRUPT, params),
  onStreamMessage: (callback: (message: any) => void) => {
    const handler = (_: any, message: any) => callback(message);
    ipcRenderer.on(IPC.CHAT_STREAM_MESSAGE, handler);
    return () => ipcRenderer.removeListener(IPC.CHAT_STREAM_MESSAGE, handler);
  },
  onStreamEnd: (callback: (data: { sessionId: string }) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on(IPC.CHAT_STREAM_END, handler);
    return () => ipcRenderer.removeListener(IPC.CHAT_STREAM_END, handler);
  },
  onStreamError: (callback: (data: { sessionId: string; error: string }) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on(IPC.CHAT_STREAM_ERROR, handler);
    return () => ipcRenderer.removeListener(IPC.CHAT_STREAM_ERROR, handler);
  },

  // Project
  openProject: () => ipcRenderer.invoke(IPC.PROJECT_OPEN),
  listRecentProjects: (limit?: number) => ipcRenderer.invoke(IPC.PROJECT_LIST_RECENT, limit),
  setCurrentProject: (path: string) => ipcRenderer.invoke(IPC.PROJECT_SET_CURRENT, path),
  listProjectFiles: (cwd: string) => ipcRenderer.invoke(IPC.EXPLORER_LIST_FILES, cwd),
  readProjectFile: (params: { cwd: string; filePath: string }) =>
    ipcRenderer.invoke(IPC.EXPLORER_READ_FILE, params),
  listGitBranches: (cwd: string) => ipcRenderer.invoke(IPC.GIT_LIST_BRANCHES, cwd),
  switchGitBranch: (params: { cwd: string; branch: string }) =>
    ipcRenderer.invoke(IPC.GIT_SWITCH_BRANCH, params),
  listGitChanges: (cwd: string) => ipcRenderer.invoke(IPC.GIT_LIST_CHANGES, cwd),
  getGitDiff: (params: { cwd: string; filePath: string }) =>
    ipcRenderer.invoke(IPC.GIT_GET_DIFF, params),

  // Auth (CLI-based)
  getAuthStatus: () => ipcRenderer.invoke(IPC.AUTH_STATUS),
  login: () => ipcRenderer.invoke(IPC.AUTH_LOGIN),
  logout: () => ipcRenderer.invoke(IPC.AUTH_LOGOUT),
  cancelLogin: () => ipcRenderer.invoke(IPC.AUTH_CANCEL_LOGIN),

  // Sessions
  createSession: (projectId: string, provider?: string) =>
    ipcRenderer.invoke(IPC.SESSION_CREATE, { projectId, provider }),
  listSessions: (projectId: string) => ipcRenderer.invoke(IPC.SESSION_LIST, projectId),
  getSession: (sessionId: string) => ipcRenderer.invoke(IPC.SESSION_GET, sessionId),
  deleteSession: (sessionId: string) => ipcRenderer.invoke(IPC.SESSION_DELETE, sessionId),

  // Terminal
  createTerminal: (id: string, cwd: string) =>
    ipcRenderer.invoke(IPC.TERMINAL_CREATE, { id, cwd }),
  writeTerminal: (id: string, data: string) =>
    ipcRenderer.invoke(IPC.TERMINAL_WRITE, { id, data }),
  resizeTerminal: (id: string, cols: number, rows: number) =>
    ipcRenderer.invoke(IPC.TERMINAL_RESIZE, { id, cols, rows }),
  closeTerminal: (id: string) => ipcRenderer.invoke(IPC.TERMINAL_CLOSE, { id }),
  onTerminalData: (callback: (data: { id: string; data: string }) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on(IPC.TERMINAL_DATA, handler);
    return () => ipcRenderer.removeListener(IPC.TERMINAL_DATA, handler);
  },

  // Approval
  onApprovalRequest: (callback: (request: any) => void) => {
    const handler = (_: any, request: any) => callback(request);
    ipcRenderer.on(IPC.APPROVAL_REQUEST, handler);
    return () => ipcRenderer.removeListener(IPC.APPROVAL_REQUEST, handler);
  },
  respondApproval: (id: string, approved: boolean) =>
    ipcRenderer.send(IPC.APPROVAL_RESPOND, { id, approved }),

  // Menu events
  onMenuEvent: (event: string, callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(event, handler);
    return () => ipcRenderer.removeListener(event, handler);
  },
};

contextBridge.exposeInMainWorld('omnicode', api);

export type OmniCodeAPI = typeof api;
