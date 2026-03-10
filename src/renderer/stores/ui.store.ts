import { create } from 'zustand';

type View = 'chat' | 'settings' | 'welcome';
type AgentMode = 'code' | 'plan' | 'ask';

interface UIState {
  sidebarWidth: number;
  rightPaneWidth: number;
  sidebarCollapsed: boolean;
  terminalOpen: boolean;
  terminalHeight: number;
  activeView: View;
  theme: 'dark' | 'light';
  agentMode: AgentMode;
  setSidebarWidth: (width: number) => void;
  setRightPaneWidth: (width: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleTerminal: () => void;
  setTerminalOpen: (open: boolean) => void;
  setTerminalHeight: (height: number) => void;
  setActiveView: (view: View) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setAgentMode: (mode: AgentMode) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarWidth: 300,
  rightPaneWidth: 440,
  sidebarCollapsed: false,
  terminalOpen: false,
  terminalHeight: 250,
  activeView: 'welcome',
  theme: 'dark',
  agentMode: 'code',
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setRightPaneWidth: (width) => set({ rightPaneWidth: width }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),
  setTerminalOpen: (open) => set({ terminalOpen: open }),
  setTerminalHeight: (height) => set({ terminalHeight: height }),
  setActiveView: (view) => set({ activeView: view }),
  setTheme: (theme) => set({ theme }),
  setAgentMode: (mode) => set({ agentMode: mode }),
}));
