import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { resolveApproval } from '../providers/claude/permission-handler';

export function registerApprovalHandlers(): void {
  ipcMain.handle(IPC.APPROVAL_RESPOND, async (_, { id, approved }: { id: string; approved: boolean }) => {
    return { ok: resolveApproval(id, approved) };
  });
}
