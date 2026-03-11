import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { createSkill, deleteSkill, listSkills, openSkillFolder, readSkill, updateSkill } from '../services/skill.service';

export function registerSkillHandlers(): void {
  ipcMain.handle(IPC.SKILLS_LIST, async () => {
    return listSkills();
  });

  ipcMain.handle(IPC.SKILLS_READ, async (_, skillId: string) => {
    return readSkill(skillId);
  });

  ipcMain.handle(
    IPC.SKILLS_CREATE,
    async (_, { name, content, rootKey }: { name: string; content?: string; rootKey?: string }) => {
      return createSkill(name, content, rootKey);
    }
  );

  ipcMain.handle(IPC.SKILLS_UPDATE, async (_, { skillId, content }: { skillId: string; content: string }) => {
    return updateSkill(skillId, content);
  });

  ipcMain.handle(IPC.SKILLS_DELETE, async (_, skillId: string) => {
    return deleteSkill(skillId);
  });

  ipcMain.handle(IPC.SKILLS_OPEN_FOLDER, async (_, skillPath: string) => {
    return openSkillFolder(skillPath);
  });
}
