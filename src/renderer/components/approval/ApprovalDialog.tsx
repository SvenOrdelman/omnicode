import React from 'react';
import { ShieldAlert, Check, X as XIcon } from 'lucide-react';
import { useApproval } from '../../hooks/useApproval';
import { Button } from '../common/Button';

export function ApprovalDialog() {
  const { pending, respond } = useApproval();

  if (pending.length === 0) return null;

  const request = pending[0];

  return (
    <div className="border-t border-warning/30 bg-warning/5 px-4 py-3">
      <div className="mx-auto max-w-3xl">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-warning">
          <ShieldAlert size={16} />
          Tool approval required
        </div>
        <div className="mb-2 text-sm text-text-secondary">
          Claude wants to use <strong className="text-warning">{request.toolName}</strong>
        </div>
        {request.description && (
          <p className="mb-2 text-xs text-text-muted">{request.description}</p>
        )}
        <div className="rounded-lg border border-border-default bg-surface-0 p-2 mb-3">
          <pre className="text-xs text-text-muted overflow-x-auto">
            {JSON.stringify(request.toolInput, null, 2)}
          </pre>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" size="sm" icon={Check} onClick={() => respond(request.id, true)}>
            Allow
          </Button>
          <Button variant="danger" size="sm" icon={XIcon} onClick={() => respond(request.id, false)}>
            Deny
          </Button>
        </div>
      </div>
    </div>
  );
}
