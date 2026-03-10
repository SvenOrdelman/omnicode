import { useEffect, useCallback } from 'react';
import { ipc } from '../lib/ipc-client';
import { useApprovalStore } from '../stores/approval.store';
import type { ApprovalRequest } from '../../shared/provider-types';

export function useApproval() {
  const { pending, addRequest, removeRequest } = useApprovalStore();

  useEffect(() => {
    const unsub = ipc().onApprovalRequest((request: ApprovalRequest) => {
      addRequest(request);
    });
    return () => { unsub(); };
  }, [addRequest]);

  const respond = useCallback(
    (id: string, approved: boolean) => {
      ipc().respondApproval(id, approved);
      removeRequest(id);
    },
    [removeRequest]
  );

  return { pending, respond };
}
