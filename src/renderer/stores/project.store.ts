import { create } from 'zustand';
import type { Project } from '../../shared/project-types';

interface ProjectState {
  currentProject: Project | null;
  recentProjects: Project[];
  setCurrentProject: (project: Project | null) => void;
  setRecentProjects: (projects: Project[]) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  currentProject: null,
  recentProjects: [],
  setCurrentProject: (project) => set({ currentProject: project }),
  setRecentProjects: (projects) => set({ recentProjects: projects }),
}));
