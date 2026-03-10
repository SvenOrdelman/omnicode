import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { openProjectDialog, listRecentProjects, upsertProject } from '../services/project.service';

export function registerProjectHandlers(): void {
  ipcMain.handle(IPC.PROJECT_OPEN, async () => {
    return openProjectDialog();
  });

  ipcMain.handle(IPC.PROJECT_LIST_RECENT, async (_, limit?: number) => {
    return listRecentProjects(limit);
  });

  ipcMain.handle(IPC.PROJECT_SET_CURRENT, async (_, projectPath: string) => {
    return upsertProject(projectPath);
  });
}
