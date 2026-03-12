import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Shield, LogIn, LogOut, Info, Palette, Moon, Sun } from 'lucide-react';
import { ipc } from '../../lib/ipc-client';
import { useAuthStore } from '../../stores/auth.store';
import { useUIStore } from '../../stores/ui.store';
import { Button } from '../common/Button';
import { Spinner } from '../common/Spinner';

export function SettingsPanel() {
  const { installed, authenticated, account, isLoggingIn, setAuthStatus, setIsLoggingIn } =
    useAuthStore();
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    ipc().getAuthStatus().then(setAuthStatus);
  }, [setAuthStatus]);

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

  const handleLogout = useCallback(async () => {
    try {
      await ipc().logout();
      const status = await ipc().getAuthStatus();
      setAuthStatus(status);
    } catch (err: any) {
      setErrorMsg(err.message || 'Logout failed');
    }
  }, [setAuthStatus]);

  const handleCancelLogin = useCallback(() => {
    ipc().cancelLogin();
    setIsLoggingIn(false);
  }, [setIsLoggingIn]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border-subtle bg-surface-1/50 glass px-6 py-3 [-webkit-app-region:drag]">
        <Settings size={16} className="text-text-muted" />
        <h2 className="text-sm font-medium text-text-secondary">Settings</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-lg space-y-8">
          {/* Appearance */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Palette size={18} className="text-text-muted" />
              <h3 className="text-lg font-semibold text-text-primary">Appearance</h3>
            </div>

            <div className="rounded-xl border border-border-default bg-surface-2 p-4">
              <div className="mb-2 text-sm font-medium text-text-primary">Theme</div>
              <div className="inline-flex items-center rounded-lg border border-border-default bg-surface-1 p-0.5">
                <button
                  onClick={() => setTheme('dark')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    theme === 'dark'
                      ? 'bg-surface-3 text-text-primary shadow-sm'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  <Moon size={13} />
                  Dark
                </button>
                <button
                  onClick={() => setTheme('light')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    theme === 'light'
                      ? 'bg-surface-3 text-text-primary shadow-sm'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  <Sun size={13} />
                  Light
                </button>
              </div>
            </div>
          </section>

          {/* Claude Authentication */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Shield size={18} className="text-text-muted" />
              <h3 className="text-lg font-semibold text-text-primary">Authentication</h3>
            </div>

            <div className="rounded-xl border border-border-default bg-surface-2 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-text-primary">Claude (Anthropic)</div>
                  <div className="text-xs text-text-muted">
                    {!installed
                      ? 'Claude CLI not found'
                      : authenticated
                        ? account || 'Logged in'
                        : 'Not logged in'}
                  </div>
                </div>
                <div
                  className={`h-2 w-2 rounded-full ${
                    authenticated ? 'bg-success' : installed ? 'bg-warning' : 'bg-danger'
                  }`}
                />
              </div>

              {!installed ? (
                <div className="space-y-2">
                  <p className="text-sm text-text-secondary">
                    The Claude CLI is required. Install it with:
                  </p>
                  <code className="block rounded-lg bg-surface-0 px-3 py-2 text-sm text-text-secondary border border-border-subtle">
                    npm install -g @anthropic-ai/claude-code
                  </code>
                </div>
              ) : authenticated ? (
                <Button variant="danger" size="sm" onClick={handleLogout} icon={LogOut}>
                  Log Out
                </Button>
              ) : isLoggingIn ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Spinner size={14} />
                    <span>Waiting for login... A browser window should open.</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleCancelLogin}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Button variant="primary" size="sm" onClick={handleLogin} icon={LogIn}>
                    Log in with Claude
                  </Button>
                  {errorMsg && <p className="text-sm text-danger">{errorMsg}</p>}
                </div>
              )}
            </div>
          </section>

          {/* About */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Info size={18} className="text-text-muted" />
              <h3 className="text-lg font-semibold text-text-primary">About</h3>
            </div>
            <div className="rounded-xl border border-border-default bg-surface-2 p-4">
              <p className="text-sm text-text-secondary">
                OmniCode v0.1.0 - Desktop IDE for LLM coding agents
              </p>
              <p className="mt-1 text-xs text-text-muted">
                Built with Electron, React, and the Claude Agent SDK
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
