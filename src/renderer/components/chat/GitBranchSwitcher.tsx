import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, GitBranch, Loader2 } from 'lucide-react';
import { ipc } from '../../lib/ipc-client';
import { useProjectStore } from '../../stores/project.store';

interface BranchState {
  branches: string[];
  current: string | null;
}

export function GitBranchSwitcher() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branchState, setBranchState] = useState<BranchState>({ branches: [], current: null });
  const ref = useRef<HTMLDivElement>(null);

  const loadBranches = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    setError(null);
    try {
      const result = await ipc().listGitBranches(currentProject.path);
      setBranchState(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load branches';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    loadBranches().catch(() => undefined);
  }, [loadBranches]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  if (!currentProject) return null;

  const hasRepo = branchState.branches.length > 0;
  const currentBranch = branchState.current ?? 'No git repo';

  const handleSwitch = async (branch: string) => {
    if (!currentProject || branch === branchState.current || switching) return;
    setSwitching(true);
    setError(null);
    try {
      await ipc().switchGitBranch({ cwd: currentProject.path, branch });
      await loadBranches();
      setOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not switch branch';
      setError(message);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => hasRepo && setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
          hasRepo
            ? 'border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary'
            : 'cursor-not-allowed border-border-subtle text-text-muted'
        }`}
        disabled={!hasRepo}
      >
        <GitBranch size={13} />
        <span className="max-w-[150px] truncate">{currentBranch}</span>
        {loading || switching ? <Loader2 size={13} className="animate-spin" /> : <ChevronDown size={13} />}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border-default bg-surface-2 p-1 shadow-xl">
          <div className="max-h-56 overflow-y-auto">
            {branchState.branches.map((branch) => {
              const active = branch === branchState.current;
              return (
                <button
                  key={branch}
                  onClick={() => handleSwitch(branch)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                    active
                      ? 'bg-accent-muted text-text-primary'
                      : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
                  }`}
                >
                  <span className="truncate">{branch}</span>
                  {active && <Check size={13} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className="mt-1 max-w-64 truncate text-xs text-danger">{error}</p>}
    </div>
  );
}
