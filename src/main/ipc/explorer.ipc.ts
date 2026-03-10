import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import {
  listProjectFiles,
  readProjectFile,
  searchProjectContent,
  writeProjectFile,
} from '../services/explorer.service';

export function registerExplorerHandlers(): void {
  ipcMain.handle(IPC.EXPLORER_LIST_FILES, async (_, cwd: string) => {
    return listProjectFiles(cwd);
  });

  ipcMain.handle(IPC.EXPLORER_READ_FILE, async (_, { cwd, filePath }: { cwd: string; filePath: string }) => {
    return readProjectFile(cwd, filePath);
  });

  ipcMain.handle(
    IPC.EXPLORER_WRITE_FILE,
    async (_, { cwd, filePath, content }: { cwd: string; filePath: string; content: string }) => {
      await writeProjectFile(cwd, filePath, content);
      return { ok: true };
    }
  );

  ipcMain.handle(IPC.EXPLORER_SEARCH_CONTENT, async (_, { cwd, query }: { cwd: string; query: string }) => {
    return searchProjectContent(cwd, query);
  });
}
