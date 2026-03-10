import React, { useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { useUIStore } from './stores/ui.store';
import { useAuthStore } from './stores/auth.store';
import { ipc } from './lib/ipc-client';

export function App() {
  const { setActiveView, toggleTerminal } = useUIStore();
  const setAuthStatus = useAuthStore((s) => s.setAuthStatus);

  // Check auth on mount
  useEffect(() => {
    ipc()
      .getAuthStatus()
      .then((status) => {
        setAuthStatus(status);
        if (!status.authenticated) setActiveView('welcome');
      })
      .catch(console.error);
  }, [setAuthStatus, setActiveView]);

  // Menu event listeners
  useEffect(() => {
    const unsubs = [
      ipc().onMenuEvent('menu:new-chat', () => setActiveView('chat')),
      ipc().onMenuEvent('menu:open-project', () => {
        ipc().openProject();
      }),
      ipc().onMenuEvent('menu:settings', () => setActiveView('settings')),
      ipc().onMenuEvent('menu:toggle-terminal', () => toggleTerminal()),
    ];
    return () => unsubs.forEach((u) => u());
  }, [setActiveView, toggleTerminal]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key === 'j') {
        e.preventDefault();
        toggleTerminal();
      }
      if (cmd && e.key === 'n') {
        e.preventDefault();
        setActiveView('chat');
      }
      if (cmd && e.key === ',') {
        e.preventDefault();
        setActiveView('settings');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleTerminal, setActiveView]);

  return <AppLayout />;
}
