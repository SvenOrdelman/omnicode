import { create } from 'zustand';
import type { ProviderMessage, ProviderStatus } from '../../shared/provider-types';
import type { Session } from '../../shared/session-types';

interface ChatState {
  activeSession: Session | null;
  messages: ProviderMessage[];
  status: ProviderStatus;
  error: string | null;
  setActiveSession: (session: Session | null) => void;
  setMessages: (messages: ProviderMessage[]) => void;
  addMessage: (message: ProviderMessage) => void;
  updateLastMessage: (updater: (msg: ProviderMessage) => ProviderMessage) => void;
  setStatus: (status: ProviderStatus) => void;
  setError: (error: string | null) => void;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeSession: null,
  messages: [],
  status: 'idle',
  error: null,
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
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  clearChat: () => set({ messages: [], status: 'idle', error: null }),
}));
