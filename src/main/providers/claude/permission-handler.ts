import { v4 as uuid } from 'uuid';
import type { ApprovalRequest } from '../../../shared/provider-types';

// Manages pending tool-use approval requests.
// When Claude wants to use a tool, we create a Promise that resolves
// when the user responds via the UI.

interface PendingApproval {
  resolve: (approved: boolean) => void;
  request: ApprovalRequest;
  timeout: NodeJS.Timeout;
}

const pendingApprovals = new Map<string, PendingApproval>();
const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000;

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
    const timeout = setTimeout(() => {
      const pending = pendingApprovals.get(id);
      if (!pending) return;
      pendingApprovals.delete(id);
      pending.resolve(false);
    }, APPROVAL_TIMEOUT_MS);

    pendingApprovals.set(id, { resolve, request, timeout });
  });

  return { request, promise };
}

export function resolveApproval(id: string, approved: boolean): boolean {
  const pending = pendingApprovals.get(id);
  if (!pending) return false;

  clearTimeout(pending.timeout);
  pending.resolve(approved);
  pendingApprovals.delete(id);
  return true;
}

export function cancelAllApprovals(sessionId: string): void {
  for (const [id, pending] of pendingApprovals) {
    if (pending.request.sessionId === sessionId) {
      clearTimeout(pending.timeout);
      pending.resolve(false);
      pendingApprovals.delete(id);
    }
  }
}
