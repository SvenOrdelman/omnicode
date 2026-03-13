import { useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { ipc } from '../lib/ipc-client';
import { useTerminalStore } from '../stores/terminal.store';
import { useProjectStore } from '../stores/project.store';
import { useUIStore } from '../stores/ui.store';

export function useTerminal() {
  const { sessions, activeId, addSession, removeSession, setActiveId } = useTerminalStore();
  const currentProject = useProjectStore((s) => s.currentProject);
  const setTerminalOpen = useUIStore((s) => s.setTerminalOpen);

  const create = useCallback(async () => {
    if (!currentProject) return null;
    const id = uuid();
    const ok = await ipc().createTerminal(id, currentProject.path);
    if (ok) {
      const nextIndex = useTerminalStore.getState().sessions.length + 1;
      addSession({ id, title: `Terminal ${nextIndex}` });
      return id;
    }
    return null;
  }, [currentProject, addSession]);

  const close = useCallback(
    async (id: string) => {
      const { sessions: currentSessions } = useTerminalStore.getState();
      const isLastSession = currentSessions.length === 1 && currentSessions[0]?.id === id;
      await ipc().closeTerminal(id);
      if (isLastSession) {
        setTerminalOpen(false);
      }
      removeSession(id);
    },
    [removeSession, setTerminalOpen]
  );

  return { sessions, activeId, create, close, setActiveId };
}
