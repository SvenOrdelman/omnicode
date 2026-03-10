import { registerChatHandlers } from './chat.ipc';
import { registerProjectHandlers } from './project.ipc';
import { registerAuthHandlers } from './auth.ipc';
import { registerSessionHandlers } from './session.ipc';
import { registerTerminalHandlers } from './terminal.ipc';
import { registerApprovalHandlers } from './approval.ipc';
import { registerGitHandlers } from './git.ipc';
import { registerExplorerHandlers } from './explorer.ipc';

export function registerAllHandlers(): void {
  registerChatHandlers();
  registerProjectHandlers();
  registerAuthHandlers();
  registerSessionHandlers();
  registerTerminalHandlers();
  registerApprovalHandlers();
  registerGitHandlers();
  registerExplorerHandlers();
}
