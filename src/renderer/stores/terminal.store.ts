import { create } from 'zustand';

interface TerminalSession {
  id: string;
  title: string;
}

interface TerminalState {
  sessions: TerminalSession[];
  activeId: string | null;
  addSession: (session: TerminalSession) => void;
  removeSession: (id: string) => void;
  setActiveId: (id: string | null) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  sessions: [],
  activeId: null,
  addSession: (session) =>
    set((s) => ({
      sessions: [...s.sessions, session],
      activeId: session.id,
    })),
  removeSession: (id) =>
    set((s) => ({
      sessions: s.sessions.filter((t) => t.id !== id),
      activeId: s.activeId === id ? (s.sessions[0]?.id ?? null) : s.activeId,
    })),
  setActiveId: (id) => set({ activeId: id }),
}));
