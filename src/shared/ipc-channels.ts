// IPC Channel constants shared between main and renderer

export const IPC = {
  // Chat
  CHAT_SEND_PROMPT: 'chat:send-prompt',
  CHAT_STREAM_MESSAGE: 'chat:stream-message',
  CHAT_STREAM_END: 'chat:stream-end',
  CHAT_STREAM_ERROR: 'chat:stream-error',
  CHAT_INTERRUPT: 'chat:interrupt',

  // Project
  PROJECT_OPEN: 'project:open',
  PROJECT_LIST_RECENT: 'project:list-recent',
  PROJECT_SET_CURRENT: 'project:set-current',
  EXPLORER_LIST_FILES: 'explorer:list-files',
  EXPLORER_READ_FILE: 'explorer:read-file',
  GIT_LIST_BRANCHES: 'git:list-branches',
  GIT_SWITCH_BRANCH: 'git:switch-branch',
  GIT_LIST_CHANGES: 'git:list-changes',
  GIT_GET_DIFF: 'git:get-diff',
  GIT_GET_FILE_VIEW: 'git:get-file-view',
  GIT_ACCEPT_FILE: 'git:accept-file',
  GIT_REJECT_FILE: 'git:reject-file',

  // Auth (CLI-based)
  AUTH_STATUS: 'auth:status',
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_CANCEL_LOGIN: 'auth:cancel-login',

  // Sessions
  SESSION_LIST: 'session:list',
  SESSION_GET: 'session:get',
  SESSION_DELETE: 'session:delete',
  SESSION_CREATE: 'session:create',

  // Terminal
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_WRITE: 'terminal:write',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_CLOSE: 'terminal:close',
  TERMINAL_DATA: 'terminal:data',

  // Approval
  APPROVAL_REQUEST: 'approval:request',
  APPROVAL_RESPOND: 'approval:respond',
} as const;

export type IPCChannel = (typeof IPC)[keyof typeof IPC];
