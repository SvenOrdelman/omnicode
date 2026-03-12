import { useEffect, useCallback } from 'react';
import { ipc } from '../lib/ipc-client';
import { useApprovalStore } from '../stores/approval.store';
import type { ApprovalRequest } from '../../shared/provider-types';

export function useApproval() {
  const { pending, addRequest, removeRequest, removeSessionRequests } = useApprovalStore();

  useEffect(() => {
    const unsubApproval = ipc().onApprovalRequest((request: ApprovalRequest) => {
      addRequest(request);
    });
    const unsubEnd = ipc().onStreamEnd(({ sessionId }) => {
      removeSessionRequests(sessionId);
    });
    const unsubError = ipc().onStreamError(({ sessionId }) => {
      removeSessionRequests(sessionId);
    });
    return () => {
      unsubApproval();
      unsubEnd();
      unsubError();
    };
  }, [addRequest, removeSessionRequests]);

  const respond = useCallback(
    (id: string, approved: boolean) => {
      ipc().respondApproval(id, approved);
      removeRequest(id);
    },
    [removeRequest]
  );

  return { pending, respond };
}
