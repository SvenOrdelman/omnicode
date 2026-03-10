import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { listProjectFiles, readProjectFile } from '../services/explorer.service';

export function registerExplorerHandlers(): void {
  ipcMain.handle(IPC.EXPLORER_LIST_FILES, async (_, cwd: string) => {
    return listProjectFiles(cwd);
  });

  ipcMain.handle(IPC.EXPLORER_READ_FILE, async (_, { cwd, filePath }: { cwd: string; filePath: string }) => {
    return readProjectFile(cwd, filePath);
  });
}
