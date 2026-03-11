import { create } from 'zustand';
import type { ProviderMessage, ProviderStatus } from '../../shared/provider-types';
import type { Session } from '../../shared/session-types';

interface ChatState {
  activeSession: Session | null;
  messages: ProviderMessage[];
  sessionStatusById: Record<string, ProviderStatus>;
  sessionErrorById: Record<string, string | null>;
  sessionCompletedById: Record<string, boolean>;
  sessionActivityById: Record<string, string[]>;
  setActiveSession: (session: Session | null) => void;
  setMessages: (messages: ProviderMessage[]) => void;
  addMessage: (message: ProviderMessage) => void;
  updateLastMessage: (updater: (msg: ProviderMessage) => ProviderMessage) => void;
  setSessionStatus: (sessionId: string, status: ProviderStatus) => void;
  setSessionError: (sessionId: string, error: string | null) => void;
  setSessionCompleted: (sessionId: string, completed: boolean) => void;
  pushSessionActivity: (sessionId: string, activity: string) => void;
  clearSessionActivity: (sessionId: string) => void;
  clearSessionState: (sessionId: string) => void;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeSession: null,
  messages: [],
  sessionStatusById: {},
  sessionErrorById: {},
  sessionCompletedById: {},
  sessionActivityById: {},
  setActiveSession: (session) => set({ activeSession: session }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((s) => {
      if (s.messages.some((m) => m.id === message.id)) {
        return s;
      }
      return { messages: [...s.messages, message] };
    }),
  updateLastMessage: (updater) =>
    set((s) => {
      if (s.messages.length === 0) return s;
      const updated = [...s.messages];
      updated[updated.length - 1] = updater(updated[updated.length - 1]);
      return { messages: updated };
    }),
  setSessionStatus: (sessionId, status) =>
    set((s) => ({
      sessionStatusById: {
        ...s.sessionStatusById,
        [sessionId]: status,
      },
    })),
  setSessionError: (sessionId, error) =>
    set((s) => ({
      sessionErrorById: {
        ...s.sessionErrorById,
        [sessionId]: error,
      },
    })),
  setSessionCompleted: (sessionId, completed) =>
    set((s) => ({
      sessionCompletedById: {
        ...s.sessionCompletedById,
        [sessionId]: completed,
      },
    })),
  pushSessionActivity: (sessionId, activity) =>
    set((s) => {
      const normalized = activity.replace(/\s+/g, ' ').trim();
      if (!normalized) return s;
      const previous = s.sessionActivityById[sessionId] ?? [];
      if (previous[previous.length - 1] === normalized) return s;
      return {
        sessionActivityById: {
          ...s.sessionActivityById,
          [sessionId]: [...previous.slice(-2), normalized],
        },
      };
    }),
  clearSessionActivity: (sessionId) =>
    set((s) => {
      const sessionActivityById = { ...s.sessionActivityById };
      delete sessionActivityById[sessionId];
      return { sessionActivityById };
    }),
  clearSessionState: (sessionId) =>
    set((s) => {
      const sessionStatusById = { ...s.sessionStatusById };
      const sessionErrorById = { ...s.sessionErrorById };
      const sessionCompletedById = { ...s.sessionCompletedById };
      const sessionActivityById = { ...s.sessionActivityById };
      delete sessionStatusById[sessionId];
      delete sessionErrorById[sessionId];
      delete sessionCompletedById[sessionId];
      delete sessionActivityById[sessionId];
      return { sessionStatusById, sessionErrorById, sessionCompletedById, sessionActivityById };
    }),
  clearChat: () => set({ messages: [] }),
}));
