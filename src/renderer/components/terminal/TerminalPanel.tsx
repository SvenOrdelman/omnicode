import React, { useEffect, useRef, useCallback } from 'react';
import { Terminal as TerminalIcon, X, Plus } from 'lucide-react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { ipc } from '../../lib/ipc-client';
import { useTerminal } from '../../hooks/useTerminal';
import { useUIStore } from '../../stores/ui.store';
import 'xterm/css/xterm.css';

const MAX_SESSION_BUFFER_CHARS = 500_000;

function appendSessionBuffer(
  buffers: Map<string, string>,
  id: string,
  chunk: string
): string {
  const next = (buffers.get(id) ?? '') + chunk;
  const bounded =
    next.length > MAX_SESSION_BUFFER_CHARS
      ? next.slice(next.length - MAX_SESSION_BUFFER_CHARS)
      : next;
  buffers.set(id, bounded);
  return bounded;
}

export function TerminalPanel() {
  const { sessions, activeId, create, close, setActiveId } = useTerminal();
  const theme = useUIStore((s) => s.theme);
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const activeIdRef = useRef<string | null>(activeId);
  const sessionBuffersRef = useRef<Map<string, string>>(new Map());

  // Create terminal on mount if none exist
  useEffect(() => {
    if (sessions.length === 0) {
      create();
    }
  }, [sessions.length, create]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Keep only buffers for existing sessions
  useEffect(() => {
    const activeSessionIds = new Set(sessions.map((session) => session.id));
    for (const id of sessionBuffersRef.current.keys()) {
      if (!activeSessionIds.has(id)) {
        sessionBuffersRef.current.delete(id);
      }
    }
  }, [sessions]);

  // Receive pty output for all sessions and keep in per-session buffers.
  useEffect(() => {
    return ipc().onTerminalData(({ id, data }) => {
      appendSessionBuffer(sessionBuffersRef.current, id, data);
      if (id === activeIdRef.current) {
        xtermRef.current?.write(data);
      }
    });
  }, []);

  // Initialize xterm when active terminal changes
  useEffect(() => {
    if (!activeId || !termRef.current) return;

    // Clean up previous terminal
    if (xtermRef.current) {
      xtermRef.current.dispose();
    }

    const term = new Terminal({
      theme: {
        background: theme === 'light' ? '#ffffff' : '#1e1e1e',
        foreground: theme === 'light' ? '#1f1f1f' : '#d4d4d4',
        cursor: theme === 'light' ? '#1f1f1f' : '#aeafad',
        selectionBackground: theme === 'light' ? '#add6ff' : '#3a3d41',
      },
      fontFamily: 'SF Mono, Menlo, Monaco, monospace',
      fontSize: 13,
      lineHeight: 1.4,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(termRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const bufferedData = sessionBuffersRef.current.get(activeId);
    if (bufferedData) {
      term.write(bufferedData);
    }

    // Send user input to pty
    term.onData((data) => {
      ipc().writeTerminal(activeId, data);
    });

    // Handle resize
    const resizeHandler = () => {
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      if (dims) {
        ipc().resizeTerminal(activeId, dims.cols, dims.rows);
      }
    };

    const observer = new ResizeObserver(resizeHandler);
    observer.observe(termRef.current);

    return () => {
      observer.disconnect();
      term.dispose();
      xtermRef.current = null;
    };
  }, [activeId, theme]);

  const handleNewTab = useCallback(() => {
    create();
  }, [create]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-0">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border-subtle px-1 py-1">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveId(s.id)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors ${
              s.id === activeId
                ? 'bg-surface-0 text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <TerminalIcon size={12} />
            {s.title}
            <span
              onClick={(e) => {
                e.stopPropagation();
                close(s.id);
              }}
              className="ml-0.5 rounded p-0.5 hover:text-danger hover:bg-danger/10 transition-colors"
            >
              <X size={11} />
            </span>
          </button>
        ))}
        <button
          onClick={handleNewTab}
          className="ml-1 rounded-md p-1 text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>
      {/* Terminal content */}
      <div ref={termRef} className="min-h-0 flex-1" />
    </div>
  );
}
