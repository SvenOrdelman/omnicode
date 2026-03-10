import { create } from 'zustand';
import type { ApprovalRequest } from '../../shared/provider-types';

interface ApprovalState {
  pending: ApprovalRequest[];
  addRequest: (request: ApprovalRequest) => void;
  removeRequest: (id: string) => void;
  clearAll: () => void;
}

export const useApprovalStore = create<ApprovalState>((set) => ({
  pending: [],
  addRequest: (request) => set((s) => ({ pending: [...s.pending, request] })),
  removeRequest: (id) => set((s) => ({ pending: s.pending.filter((r) => r.id !== id) })),
  clearAll: () => set({ pending: [] }),
}));
