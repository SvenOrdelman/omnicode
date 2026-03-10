import React, { useEffect, useRef, useCallback } from 'react';
import { Terminal as TerminalIcon, X, Plus } from 'lucide-react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { ipc } from '../../lib/ipc-client';
import { useTerminal } from '../../hooks/useTerminal';
import 'xterm/css/xterm.css';

export function TerminalPanel() {
  const { sessions, activeId, create, close, setActiveId } = useTerminal();
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Create terminal on mount if none exist
  useEffect(() => {
    if (sessions.length === 0) {
      create();
    }
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
        background: '#09090b',
        foreground: '#e4e4e7',
        cursor: '#a78bfa',
        selectionBackground: '#3f3f46',
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

    // Send user input to pty
    term.onData((data) => {
      ipc().writeTerminal(activeId, data);
    });

    // Receive pty output
    const unsubData = ipc().onTerminalData(({ id, data }) => {
      if (id === activeId) {
        term.write(data);
      }
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
      unsubData();
      term.dispose();
      xtermRef.current = null;
    };
  }, [activeId]);

  const handleNewTab = useCallback(() => {
    create();
  }, [create]);

  return (
    <div className="flex h-full flex-col bg-surface-0">
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
      <div ref={termRef} className="flex-1" />
    </div>
  );
}
