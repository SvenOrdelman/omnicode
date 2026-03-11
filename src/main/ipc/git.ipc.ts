import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import {
  acceptGitFile,
  commitGitChanges,
  fetchGitChanges,
  getGitDiff,
  getGitFileView,
  listGitBranches,
  listGitChanges,
  pushGitChanges,
  rejectGitFile,
  switchGitBranch,
} from '../services/git.service';

function registerHandler(channel: string, handler: Parameters<typeof ipcMain.handle>[1]): void {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, handler);
}

export function registerGitHandlers(): void {
  registerHandler(IPC.GIT_LIST_BRANCHES, async (_, cwd: string) => {
    return listGitBranches(cwd);
  });

  registerHandler(IPC.GIT_SWITCH_BRANCH, async (_, { cwd, branch }: { cwd: string; branch: string }) => {
    await switchGitBranch(cwd, branch);
    return { ok: true };
  });

  registerHandler(IPC.GIT_LIST_CHANGES, async (_, cwd: string) => {
    return listGitChanges(cwd);
  });

  registerHandler(IPC.GIT_GET_DIFF, async (_, { cwd, filePath }: { cwd: string; filePath: string }) => {
    return getGitDiff(cwd, filePath);
  });

  registerHandler(IPC.GIT_GET_FILE_VIEW, async (_, { cwd, filePath }: { cwd: string; filePath: string }) => {
    return getGitFileView(cwd, filePath);
  });

  registerHandler(IPC.GIT_ACCEPT_FILE, async (_, { cwd, filePath }: { cwd: string; filePath: string }) => {
    await acceptGitFile(cwd, filePath);
    return { ok: true };
  });

  registerHandler(IPC.GIT_REJECT_FILE, async (_, { cwd, filePath }: { cwd: string; filePath: string }) => {
    await rejectGitFile(cwd, filePath);
    return { ok: true };
  });

  registerHandler(
    IPC.GIT_COMMIT,
    async (
      _,
      {
        cwd,
        title,
        message,
        filePaths,
      }: { cwd: string; title: string; message?: string; filePaths: string[] }
    ) => {
      await commitGitChanges(cwd, { title, message, filePaths });
      return { ok: true };
    }
  );

  registerHandler(
    IPC.GIT_PUSH,
    async (_, { cwd, remote, branch }: { cwd: string; remote?: string; branch?: string }) => {
      await pushGitChanges(cwd, { remote, branch });
      return { ok: true };
    }
  );

  registerHandler(IPC.GIT_FETCH, async (_, cwd: string) => {
    await fetchGitChanges(cwd);
    return { ok: true };
  });
}
