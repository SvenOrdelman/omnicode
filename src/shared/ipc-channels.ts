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
  EXPLORER_WRITE_FILE: 'explorer:write-file',
  EXPLORER_SEARCH_CONTENT: 'explorer:search-content',
  GIT_LIST_BRANCHES: 'git:list-branches',
  GIT_SWITCH_BRANCH: 'git:switch-branch',
  GIT_LIST_CHANGES: 'git:list-changes',
  GIT_GET_DIFF: 'git:get-diff',
  GIT_GET_FILE_VIEW: 'git:get-file-view',
  GIT_ACCEPT_FILE: 'git:accept-file',
  GIT_REJECT_FILE: 'git:reject-file',
  GIT_COMMIT: 'git:commit',
  GIT_PUSH: 'git:push',
  GIT_FETCH: 'git:fetch',

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
  SESSION_ADD_MESSAGE: 'session:add-message',
  SESSION_ARCHIVE: 'session:archive',

  // Terminal
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_WRITE: 'terminal:write',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_CLOSE: 'terminal:close',
  TERMINAL_DATA: 'terminal:data',

  // Approval
  APPROVAL_REQUEST: 'approval:request',
  APPROVAL_RESPOND: 'approval:respond',

  // Automations
  AUTOMATIONS_GET_REMOTE_URL: 'automations:get-remote-url',
  AUTOMATIONS_OPEN_REMOTE: 'automations:open-remote',

  // Skills
  SKILLS_LIST: 'skills:list',
  SKILLS_READ: 'skills:read',
  SKILLS_CREATE: 'skills:create',
  SKILLS_UPDATE: 'skills:update',
  SKILLS_DELETE: 'skills:delete',
  SKILLS_OPEN_FOLDER: 'skills:open-folder',
} as const;

export type IPCChannel = (typeof IPC)[keyof typeof IPC];
