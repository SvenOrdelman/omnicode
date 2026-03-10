import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project } from '../../shared/project-types';

interface ProjectState {
  currentProject: Project | null;
  recentProjects: Project[];
  setCurrentProject: (project: Project | null) => void;
  setRecentProjects: (projects: Project[]) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      currentProject: null,
      recentProjects: [],
      setCurrentProject: (project) => set({ currentProject: project }),
      setRecentProjects: (projects) => set({ recentProjects: projects }),
    }),
    {
      name: 'omnicode-project-store',
      partialize: (state) => ({
        currentProject: state.currentProject,
      }),
    }
  )
);
