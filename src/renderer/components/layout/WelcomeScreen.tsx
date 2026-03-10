import React, { useCallback, useState } from 'react';
import { Zap, FolderOpen, AlertTriangle, LogIn, Clock } from 'lucide-react';
import { useProject } from '../../hooks/useProject';
import { useAuthStore } from '../../stores/auth.store';
import { ipc } from '../../lib/ipc-client';
import { Button } from '../common/Button';
import { Spinner } from '../common/Spinner';

export function WelcomeScreen() {
  const { recentProjects, openProject, selectProject } = useProject();
  const { installed, authenticated, isLoggingIn, setAuthStatus, setIsLoggingIn } = useAuthStore();
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = useCallback(async () => {
    setIsLoggingIn(true);
    setErrorMsg('');
    try {
      const result = await ipc().login();
      if (result.success) {
        const status = await ipc().getAuthStatus();
        setAuthStatus(status);
      } else {
        setErrorMsg(result.error || 'Login failed');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  }, [setAuthStatus, setIsLoggingIn]);

  return (
    <div className="flex h-full items-center justify-center p-8 sm:p-12">
      <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface-1/70 p-8 text-center shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
        <div className="space-y-8">
        <div>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15">
            <Zap size={32} className="text-accent" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary">OmniCode</h1>
          <p className="mt-2 text-text-secondary">Desktop IDE for LLM coding agents</p>
        </div>

        {!installed && (
          <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
            <div className="flex items-center justify-center gap-2 mb-2">
              <AlertTriangle size={16} />
              <span className="font-medium">Claude CLI is not installed</span>
            </div>
            <code className="mt-2 block rounded-lg bg-surface-0 px-3 py-2 text-xs text-text-secondary border border-border-subtle">
              npm install -g @anthropic-ai/claude-code
            </code>
          </div>
        )}

        {installed && !authenticated && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
            <div className="flex items-center justify-center gap-2 mb-3">
              <LogIn size={16} />
              <span className="font-medium">Log in to Claude to get started</span>
            </div>
            {isLoggingIn ? (
              <div className="flex items-center justify-center gap-2 text-text-secondary">
                <Spinner size={14} />
                <span>Waiting for login...</span>
              </div>
            ) : (
              <Button variant="primary" size="sm" className="w-full" onClick={handleLogin} icon={LogIn}>
                Log in with Claude
              </Button>
            )}
            {errorMsg && <p className="mt-2 text-sm text-danger">{errorMsg}</p>}
          </div>
        )}

        <div className="space-y-3">
          <Button onClick={openProject} className="w-full" disabled={!authenticated} icon={FolderOpen}>
            Open Project Folder
          </Button>
        </div>

        {recentProjects.length > 0 && (
          <div className="text-left">
            <div className="mb-2 flex items-center gap-1.5 px-1">
              <Clock size={12} className="text-text-muted" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Recent Projects
              </h3>
            </div>
            <div className="space-y-1">
              {recentProjects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectProject(p.path)}
                  disabled={!authenticated}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-3 disabled:opacity-50 transition-colors"
                >
                  <FolderOpen size={14} className="flex-shrink-0 text-text-muted" />
                  <div className="min-w-0">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-text-muted truncate">{p.path}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
