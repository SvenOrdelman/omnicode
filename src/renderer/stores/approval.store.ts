import { create } from 'zustand';
import type { ApprovalRequest } from '../../shared/provider-types';

interface ApprovalState {
  pending: ApprovalRequest[];
  addRequest: (request: ApprovalRequest) => void;
  removeRequest: (id: string) => void;
  removeSessionRequests: (sessionId: string) => void;
  clearAll: () => void;
}

export const useApprovalStore = create<ApprovalState>((set) => ({
  pending: [],
  addRequest: (request) => set((s) => ({ pending: [...s.pending, request] })),
  removeRequest: (id) => set((s) => ({ pending: s.pending.filter((r) => r.id !== id) })),
  removeSessionRequests: (sessionId) => set((s) => ({ pending: s.pending.filter((r) => r.sessionId !== sessionId) })),
  clearAll: () => set({ pending: [] }),
}));
