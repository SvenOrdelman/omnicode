import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import {
  acceptGitFile,
  getGitDiff,
  getGitFileView,
  listGitBranches,
  listGitChanges,
  rejectGitFile,
  switchGitBranch,
} from '../services/git.service';

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

  ipcMain.handle(IPC.GIT_GET_FILE_VIEW, async (_, { cwd, filePath }: { cwd: string; filePath: string }) => {
    return getGitFileView(cwd, filePath);
  });

  ipcMain.handle(IPC.GIT_ACCEPT_FILE, async (_, { cwd, filePath }: { cwd: string; filePath: string }) => {
    await acceptGitFile(cwd, filePath);
    return { ok: true };
  });

  ipcMain.handle(IPC.GIT_REJECT_FILE, async (_, { cwd, filePath }: { cwd: string; filePath: string }) => {
    await rejectGitFile(cwd, filePath);
    return { ok: true };
  });
}
