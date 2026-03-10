import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { resolveApproval } from '../providers/claude/permission-handler';

export function registerApprovalHandlers(): void {
  ipcMain.on(IPC.APPROVAL_RESPOND, (_, { id, approved }: { id: string; approved: boolean }) => {
    resolveApproval(id, approved);
  });
}
