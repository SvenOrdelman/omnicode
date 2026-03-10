import { v4 as uuid } from 'uuid';
import type { ApprovalRequest } from '../../../shared/provider-types';

// Manages pending tool-use approval requests.
// When Claude wants to use a tool, we create a Promise that resolves
// when the user responds via the UI.

interface PendingApproval {
  resolve: (approved: boolean) => void;
  request: ApprovalRequest;
}

const pendingApprovals = new Map<string, PendingApproval>();

export function createApprovalRequest(
  sessionId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
  description: string
): { request: ApprovalRequest; promise: Promise<boolean> } {
  const id = uuid();
  const request: ApprovalRequest = {
    id,
    sessionId,
    toolName,
    toolInput,
    description,
    timestamp: Date.now(),
  };

  const promise = new Promise<boolean>((resolve) => {
    pendingApprovals.set(id, { resolve, request });
  });

  return { request, promise };
}

export function resolveApproval(id: string, approved: boolean): boolean {
  const pending = pendingApprovals.get(id);
  if (!pending) return false;

  pending.resolve(approved);
  pendingApprovals.delete(id);
  return true;
}

export function cancelAllApprovals(sessionId: string): void {
  for (const [id, pending] of pendingApprovals) {
    if (pending.request.sessionId === sessionId) {
      pending.resolve(false);
      pendingApprovals.delete(id);
    }
  }
}
