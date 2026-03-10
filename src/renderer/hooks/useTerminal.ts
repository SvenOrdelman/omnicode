import { useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { ipc } from '../lib/ipc-client';
import { useTerminalStore } from '../stores/terminal.store';
import { useProjectStore } from '../stores/project.store';

export function useTerminal() {
  const { sessions, activeId, addSession, removeSession, setActiveId } = useTerminalStore();
  const currentProject = useProjectStore((s) => s.currentProject);

  const create = useCallback(async () => {
    if (!currentProject) return null;
    const id = uuid();
    const ok = await ipc().createTerminal(id, currentProject.path);
    if (ok) {
      addSession({ id, title: `Terminal ${sessions.length + 1}` });
      return id;
    }
    return null;
  }, [currentProject, sessions.length, addSession]);

  const close = useCallback(
    async (id: string) => {
      await ipc().closeTerminal(id);
      removeSession(id);
    },
    [removeSession]
  );

  return { sessions, activeId, create, close, setActiveId };
}
