import React, { useCallback } from 'react';
import { useUIStore } from '../../stores/ui.store';
import { Sidebar } from '../sidebar/Sidebar';
import { ChatView } from '../chat/ChatView';
import { TerminalPanel } from '../terminal/TerminalPanel';
import { SettingsPanel } from '../settings/SettingsPanel';
import { WelcomeScreen } from './WelcomeScreen';
import { ResizeHandle } from './ResizeHandle';
import { RightPane } from '../explorer/RightPane';

export function AppLayout() {
  const {
    sidebarWidth,
    rightPaneWidth,
    sidebarCollapsed,
    terminalOpen,
    terminalHeight,
    activeView,
    setSidebarWidth,
    setRightPaneWidth,
    setTerminalHeight,
  } =
    useUIStore();

  const handleSidebarResize = useCallback(
    (delta: number) => {
      setSidebarWidth(Math.max(240, Math.min(560, sidebarWidth + delta)));
    },
    [sidebarWidth, setSidebarWidth]
  );

  const handleTerminalResize = useCallback(
    (delta: number) => {
      setTerminalHeight(Math.max(100, Math.min(600, terminalHeight - delta)));
    },
    [terminalHeight, setTerminalHeight]
  );

  const handleRightPaneResize = useCallback(
    (delta: number) => {
      setRightPaneWidth(Math.max(280, Math.min(720, rightPaneWidth - delta)));
    },
    [rightPaneWidth, setRightPaneWidth]
  );

  const renderCenter = () => {
    switch (activeView) {
      case 'settings':
        return <SettingsPanel />;
      case 'chat':
        return <ChatView />;
      case 'welcome':
      default:
        return <WelcomeScreen />;
    }
  };

  const sidebarDisplayWidth = sidebarCollapsed ? 56 : sidebarWidth;

  return (
    <div className="flex h-screen w-screen gap-2 overflow-hidden bg-surface-0 p-3 text-text-primary">
      {/* Sidebar */}
      <div
        style={{ width: sidebarDisplayWidth }}
        className="flex-shrink-0 overflow-hidden rounded-2xl border border-border-subtle/70 transition-[width] duration-200 ease-in-out"
      >
        <Sidebar collapsed={sidebarCollapsed} />
      </div>
      {!sidebarCollapsed && <ResizeHandle direction="horizontal" onResize={handleSidebarResize} />}

      <div className="flex min-w-0 flex-1">
        {/* Main content area */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border-subtle/70">
          {/* Center pane */}
          <div className="flex-1 overflow-hidden">{renderCenter()}</div>

          {/* Terminal */}
          {terminalOpen && (
            <>
              <ResizeHandle direction="vertical" onResize={handleTerminalResize} />
              <div style={{ height: terminalHeight }} className="flex-shrink-0">
                <TerminalPanel />
              </div>
            </>
          )}
        </div>

        <ResizeHandle direction="horizontal" onResize={handleRightPaneResize} />

        {/* Right explorer pane */}
        <div
          style={{ width: rightPaneWidth }}
          className="flex-shrink-0 overflow-hidden rounded-2xl border border-border-subtle/70"
        >
          <RightPane />
        </div>
      </div>
    </div>
  );
}
