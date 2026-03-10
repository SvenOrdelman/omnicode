import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { getGitDiff, listGitBranches, listGitChanges, switchGitBranch } from '../services/git.service';

export function registerGitHandlers(): void {
  ipcMain.handle(IPC.GIT_LIST_BRANCHES, async (_, cwd: string) => {
    return listGitBranches(cwd);
  });

  ipcMain.handle(IPC.GIT_SWITCH_BRANCH, async (_, { cwd, branch }: { cwd: string; branch: string }) => {
    await switchGitBranch(cwd, branch);
    return { ok: true };
  });

  ipcMain.handle(IPC.GIT_LIST_CHANGES, async (_, cwd: string) => {
    return listGitChanges(cwd);
  });

  ipcMain.handle(IPC.GIT_GET_DIFF, async (_, { cwd, filePath }: { cwd: string; filePath: string }) => {
    return getGitDiff(cwd, filePath);
  });
}
