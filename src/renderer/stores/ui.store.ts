import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_CHAT_EXECUTION_MODE,
  DEFAULT_CHAT_MODEL,
  normalizeAgentMode,
  normalizeChatExecutionMode,
  normalizeChatModelId,
} from '../../shared/chat-types';
import type { AgentMode, ChatExecutionMode } from '../../shared/chat-types';

type View = 'chat' | 'frequent-prompts' | 'automations' | 'skills' | 'settings' | 'welcome';

interface PersistedUIState {
  sidebarWidth: number;
  rightPaneWidth: number;
  sidebarCollapsed: boolean;
  terminalOpen: boolean;
  terminalHeight: number;
  activeView: View;
  theme: 'dark' | 'light';
  agentMode: AgentMode | 'ask';
  selectedModel: string;
  selectedExecutionMode: ChatExecutionMode;
}

interface UIState {
  sidebarWidth: number;
  rightPaneWidth: number;
  sidebarCollapsed: boolean;
  terminalOpen: boolean;
  terminalHeight: number;
  activeView: View;
  theme: 'dark' | 'light';
  agentMode: AgentMode;
  selectedModel: string;
  selectedExecutionMode: ChatExecutionMode;
  setSidebarWidth: (width: number) => void;
  setRightPaneWidth: (width: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleTerminal: () => void;
  setTerminalOpen: (open: boolean) => void;
  setTerminalHeight: (height: number) => void;
  setActiveView: (view: View) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setAgentMode: (mode: AgentMode) => void;
  setSelectedModel: (model: string) => void;
  setSelectedExecutionMode: (mode: ChatExecutionMode) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarWidth: 300,
      rightPaneWidth: 440,
      sidebarCollapsed: false,
      terminalOpen: false,
      terminalHeight: 250,
      activeView: 'welcome',
      theme: 'dark',
      agentMode: 'code',
      selectedModel: DEFAULT_CHAT_MODEL,
      selectedExecutionMode: DEFAULT_CHAT_EXECUTION_MODE,
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      setRightPaneWidth: (width) => set({ rightPaneWidth: width }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),
      setTerminalOpen: (open) => set({ terminalOpen: open }),
      setTerminalHeight: (height) => set({ terminalHeight: height }),
      setActiveView: (view) => set({ activeView: view }),
      setTheme: (theme) => set({ theme }),
      setAgentMode: (mode) => set({ agentMode: normalizeAgentMode(mode) }),
      setSelectedModel: (model) => set({ selectedModel: normalizeChatModelId(model) }),
      setSelectedExecutionMode: (mode) => set({ selectedExecutionMode: normalizeChatExecutionMode(mode) }),
    }),
    {
      name: 'omnicode-ui-store',
      version: 3,
      migrate: (persistedState: unknown) => {
        const state = (persistedState ?? {}) as Partial<PersistedUIState>;
        return {
          ...state,
          agentMode: normalizeAgentMode(state.agentMode),
          selectedModel: normalizeChatModelId(state.selectedModel),
          selectedExecutionMode: normalizeChatExecutionMode(state.selectedExecutionMode),
        };
      },
      partialize: (state) => ({
        sidebarWidth: state.sidebarWidth,
        rightPaneWidth: state.rightPaneWidth,
        sidebarCollapsed: state.sidebarCollapsed,
        terminalOpen: state.terminalOpen,
        terminalHeight: state.terminalHeight,
        activeView: state.activeView,
        theme: state.theme,
        agentMode: state.agentMode,
        selectedModel: state.selectedModel,
        selectedExecutionMode: state.selectedExecutionMode,
      }),
    }
  )
);
