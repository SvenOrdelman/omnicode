import { useCallback, useEffect } from 'react';
import { ipc } from '../lib/ipc-client';
import { useProjectStore } from '../stores/project.store';
import { useUIStore } from '../stores/ui.store';

export function useProject() {
  const { currentProject, recentProjects, setCurrentProject, setRecentProjects } =
    useProjectStore();
  const setActiveView = useUIStore((s) => s.setActiveView);

  useEffect(() => {
    ipc()
      .listRecentProjects()
      .then(setRecentProjects)
      .catch(console.error);
  }, [setRecentProjects]);

  const openProject = useCallback(async () => {
    const project = await ipc().openProject();
    if (project) {
      setCurrentProject(project);
      setActiveView('chat');
      // Refresh recent projects
      const recent = await ipc().listRecentProjects();
      setRecentProjects(recent);
    }
  }, [setCurrentProject, setRecentProjects, setActiveView]);

  const selectProject = useCallback(
    async (path: string) => {
      const project = await ipc().setCurrentProject(path);
      if (project) {
        setCurrentProject(project);
        setActiveView('chat');
      }
    },
    [setCurrentProject, setActiveView]
  );

  return { currentProject, recentProjects, openProject, selectProject };
}
