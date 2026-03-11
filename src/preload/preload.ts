import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels';
import type {
  ProviderContent,
  ProviderStreamEndEvent,
  ProviderStreamErrorEvent,
  ProviderStreamMessageEvent,
} from '../shared/provider-types';
import type { SkillDocument, SkillsOverview, SkillSummary } from '../shared/skill-types';
import type { RemoteAutomationConfig } from '../shared/automation-types';

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
  onStreamMessage: (callback: (event: ProviderStreamMessageEvent) => void) => {
    const handler = (_: any, event: ProviderStreamMessageEvent) => callback(event);
    ipcRenderer.on(IPC.CHAT_STREAM_MESSAGE, handler);
    return () => ipcRenderer.removeListener(IPC.CHAT_STREAM_MESSAGE, handler);
  },
  onStreamEnd: (callback: (data: ProviderStreamEndEvent) => void) => {
    const handler = (_: any, data: ProviderStreamEndEvent) => callback(data);
    ipcRenderer.on(IPC.CHAT_STREAM_END, handler);
    return () => ipcRenderer.removeListener(IPC.CHAT_STREAM_END, handler);
  },
  onStreamError: (callback: (data: ProviderStreamErrorEvent) => void) => {
    const handler = (_: any, data: ProviderStreamErrorEvent) => callback(data);
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
  writeProjectFile: (params: { cwd: string; filePath: string; content: string }) =>
    ipcRenderer.invoke(IPC.EXPLORER_WRITE_FILE, params),
  searchProjectContent: (params: { cwd: string; query: string }) =>
    ipcRenderer.invoke(IPC.EXPLORER_SEARCH_CONTENT, params),
  listGitBranches: (cwd: string) => ipcRenderer.invoke(IPC.GIT_LIST_BRANCHES, cwd),
  switchGitBranch: (params: { cwd: string; branch: string }) =>
    ipcRenderer.invoke(IPC.GIT_SWITCH_BRANCH, params),
  listGitChanges: (cwd: string) => ipcRenderer.invoke(IPC.GIT_LIST_CHANGES, cwd),
  getGitDiff: (params: { cwd: string; filePath: string }) =>
    ipcRenderer.invoke(IPC.GIT_GET_DIFF, params),
  getGitFileView: (params: { cwd: string; filePath: string }) =>
    ipcRenderer.invoke(IPC.GIT_GET_FILE_VIEW, params),
  acceptGitFile: (params: { cwd: string; filePath: string }) =>
    ipcRenderer.invoke(IPC.GIT_ACCEPT_FILE, params),
  rejectGitFile: (params: { cwd: string; filePath: string }) =>
    ipcRenderer.invoke(IPC.GIT_REJECT_FILE, params),
  commitGitChanges: (params: { cwd: string; title: string; message?: string; filePaths: string[] }) =>
    ipcRenderer.invoke(IPC.GIT_COMMIT, params),
  pushGitChanges: (params: { cwd: string; remote?: string; branch?: string }) =>
    ipcRenderer.invoke(IPC.GIT_PUSH, params),
  fetchGitChanges: (cwd: string) => ipcRenderer.invoke(IPC.GIT_FETCH, cwd),

  // Auth (CLI-based)
  getAuthStatus: () => ipcRenderer.invoke(IPC.AUTH_STATUS),
  login: () => ipcRenderer.invoke(IPC.AUTH_LOGIN),
  logout: () => ipcRenderer.invoke(IPC.AUTH_LOGOUT),
  cancelLogin: () => ipcRenderer.invoke(IPC.AUTH_CANCEL_LOGIN),

  // Sessions
  createSession: (projectId: string, provider?: string) =>
    ipcRenderer.invoke(IPC.SESSION_CREATE, { projectId, provider }),
  listSessions: (projectId: string, includeArchived?: boolean) =>
    ipcRenderer.invoke(IPC.SESSION_LIST, { projectId, includeArchived }),
  getSession: (sessionId: string) => ipcRenderer.invoke(IPC.SESSION_GET, sessionId),
  deleteSession: (sessionId: string) => ipcRenderer.invoke(IPC.SESSION_DELETE, sessionId),
  addSessionMessage: (params: {
    sessionId: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: ProviderContent[];
  }) => ipcRenderer.invoke(IPC.SESSION_ADD_MESSAGE, params),
  archiveSession: (params: { sessionId: string; archived: boolean }) =>
    ipcRenderer.invoke(IPC.SESSION_ARCHIVE, params),

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

  // Automations
  getRemoteAutomationConfig: (): Promise<RemoteAutomationConfig> =>
    ipcRenderer.invoke(IPC.AUTOMATIONS_GET_REMOTE_URL),
  openRemoteAutomation: (url?: string): Promise<{ ok: true; url: string }> =>
    ipcRenderer.invoke(IPC.AUTOMATIONS_OPEN_REMOTE, url),

  // Skills
  listSkills: (): Promise<SkillsOverview> => ipcRenderer.invoke(IPC.SKILLS_LIST),
  readSkill: (skillId: string): Promise<SkillDocument> => ipcRenderer.invoke(IPC.SKILLS_READ, skillId),
  createSkill: (params: { name: string; content?: string }): Promise<SkillSummary> =>
    ipcRenderer.invoke(IPC.SKILLS_CREATE, params),
  updateSkill: (params: { skillId: string; content: string }): Promise<SkillSummary> =>
    ipcRenderer.invoke(IPC.SKILLS_UPDATE, params),
  deleteSkill: (skillId: string): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IPC.SKILLS_DELETE, skillId),
  openSkillFolder: (skillPath: string): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IPC.SKILLS_OPEN_FOLDER, skillPath),

  // Menu events
  onMenuEvent: (event: string, callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(event, handler);
    return () => ipcRenderer.removeListener(event, handler);
  },
};

contextBridge.exposeInMainWorld('omnicode', api);

export type OmniCodeAPI = typeof api;
