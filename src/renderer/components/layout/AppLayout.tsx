import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUIStore } from '../../stores/ui.store';
import { Sidebar } from '../sidebar/Sidebar';
import { ChatView } from '../chat/ChatView';
import { TerminalPanel } from '../terminal/TerminalPanel';
import { SettingsPanel } from '../settings/SettingsPanel';
import { WelcomeScreen } from './WelcomeScreen';
import { ResizeHandle } from './ResizeHandle';
import { RightPane } from '../explorer/RightPane';

const FRAME_PADDING = 8;
const OUTER_GAP = 8;
const RESIZE_HANDLE_SIZE = 10;
const COLLAPSED_SIDEBAR_WIDTH = 72;
const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 620;
const RIGHT_PANE_MIN = 320;
const RIGHT_PANE_MAX = 980;
const CENTER_MIN = 440;
const TERMINAL_MIN = 120;
const TERMINAL_MAX = 700;
const TERMINAL_RESERVED = 170;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

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

  const layoutRef = useRef<HTMLDivElement>(null);
  const [layoutSize, setLayoutSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!layoutRef.current) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setLayoutSize({ width, height });
    });

    observer.observe(layoutRef.current);
    return () => observer.disconnect();
  }, []);

  const innerWidth = Math.max(0, layoutSize.width - FRAME_PADDING * 2);
  const innerHeight = Math.max(0, layoutSize.height - FRAME_PADDING * 2);
  const hasMeasuredLayout = innerWidth > 0 && innerHeight > 0;
  const hasSidebarHandle = !sidebarCollapsed;
  const sidebarHandleWidth = hasSidebarHandle ? RESIZE_HANDLE_SIZE : 0;
  const rightHandleWidth = RESIZE_HANDLE_SIZE;

  const paneMetrics = useMemo(() => {
    if (!hasMeasuredLayout) {
      return {
        sidebarDisplayWidth: sidebarCollapsed ? COLLAPSED_SIDEBAR_WIDTH : sidebarWidth,
        rightPaneDisplayWidth: rightPaneWidth,
        terminalDisplayHeight: terminalHeight,
        maxSidebar: SIDEBAR_MAX,
        maxRight: RIGHT_PANE_MAX,
        maxTerminal: TERMINAL_MAX,
      };
    }

    const minRight = RIGHT_PANE_MIN;
    const minSidebar = SIDEBAR_MIN;
    const sidebarBase = sidebarCollapsed ? COLLAPSED_SIDEBAR_WIDTH : sidebarWidth;

    let computedSidebar = sidebarCollapsed ? COLLAPSED_SIDEBAR_WIDTH : sidebarBase;
    let sidebarMax = 0;
    if (!sidebarCollapsed) {
      sidebarMax = Math.max(
        minSidebar,
        innerWidth - rightPaneWidth - rightHandleWidth - OUTER_GAP - sidebarHandleWidth - CENTER_MIN
      );
      computedSidebar = clamp(computedSidebar, minSidebar, Math.min(SIDEBAR_MAX, sidebarMax));
    }

    const rightMax = Math.max(
      minRight,
      innerWidth - computedSidebar - rightHandleWidth - OUTER_GAP - sidebarHandleWidth - CENTER_MIN
    );
    const computedRight = clamp(rightPaneWidth, minRight, Math.min(RIGHT_PANE_MAX, rightMax));

    if (!sidebarCollapsed) {
      sidebarMax = Math.max(
        minSidebar,
        innerWidth - computedRight - rightHandleWidth - OUTER_GAP - sidebarHandleWidth - CENTER_MIN
      );
      computedSidebar = clamp(computedSidebar, minSidebar, Math.min(SIDEBAR_MAX, sidebarMax));
    }

    const maxTerminal = Math.max(TERMINAL_MIN, Math.min(TERMINAL_MAX, innerHeight - TERMINAL_RESERVED));
    const computedTerminal = clamp(terminalHeight, TERMINAL_MIN, maxTerminal);

    return {
      sidebarDisplayWidth: computedSidebar,
      rightPaneDisplayWidth: computedRight,
      terminalDisplayHeight: computedTerminal,
      maxSidebar: Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, sidebarMax || SIDEBAR_MAX)),
      maxRight: Math.min(RIGHT_PANE_MAX, Math.max(RIGHT_PANE_MIN, rightMax)),
      maxTerminal,
    };
  }, [
    hasMeasuredLayout,
    innerHeight,
    innerWidth,
    rightPaneWidth,
    rightHandleWidth,
    sidebarCollapsed,
    sidebarHandleWidth,
    sidebarWidth,
    terminalHeight,
  ]);

  useEffect(() => {
    if (!hasMeasuredLayout) return;
    if (!sidebarCollapsed && Math.round(paneMetrics.sidebarDisplayWidth) !== sidebarWidth) {
      setSidebarWidth(Math.round(paneMetrics.sidebarDisplayWidth));
    }
  }, [hasMeasuredLayout, paneMetrics.sidebarDisplayWidth, setSidebarWidth, sidebarCollapsed, sidebarWidth]);

  useEffect(() => {
    if (!hasMeasuredLayout) return;
    if (Math.round(paneMetrics.rightPaneDisplayWidth) !== rightPaneWidth) {
      setRightPaneWidth(Math.round(paneMetrics.rightPaneDisplayWidth));
    }
  }, [hasMeasuredLayout, paneMetrics.rightPaneDisplayWidth, rightPaneWidth, setRightPaneWidth]);

  useEffect(() => {
    if (!hasMeasuredLayout) return;
    if (terminalOpen && Math.round(paneMetrics.terminalDisplayHeight) !== terminalHeight) {
      setTerminalHeight(Math.round(paneMetrics.terminalDisplayHeight));
    }
  }, [hasMeasuredLayout, paneMetrics.terminalDisplayHeight, setTerminalHeight, terminalHeight, terminalOpen]);

  const handleSidebarResize = useCallback(
    (delta: number) => {
      if (sidebarCollapsed) return;
      setSidebarWidth(Math.round(clamp(paneMetrics.sidebarDisplayWidth + delta, SIDEBAR_MIN, paneMetrics.maxSidebar)));
    },
    [paneMetrics.maxSidebar, paneMetrics.sidebarDisplayWidth, setSidebarWidth, sidebarCollapsed]
  );

  const handleTerminalResize = useCallback(
    (delta: number) => {
      setTerminalHeight(Math.round(clamp(paneMetrics.terminalDisplayHeight - delta, TERMINAL_MIN, paneMetrics.maxTerminal)));
    },
    [paneMetrics.maxTerminal, paneMetrics.terminalDisplayHeight, setTerminalHeight]
  );

  const handleRightPaneResize = useCallback(
    (delta: number) => {
      setRightPaneWidth(Math.round(clamp(paneMetrics.rightPaneDisplayWidth - delta, RIGHT_PANE_MIN, paneMetrics.maxRight)));
    },
    [paneMetrics.maxRight, paneMetrics.rightPaneDisplayWidth, setRightPaneWidth]
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

  return (
    <div
      ref={layoutRef}
      className="flex h-screen w-screen overflow-hidden bg-surface-0 text-text-primary"
      style={{ padding: 8, gap: 8 }}
    >
      {/* Sidebar */}
      <div
        style={{ width: paneMetrics.sidebarDisplayWidth }}
        className="flex-shrink-0 overflow-hidden rounded-2xl border border-border-subtle/75 bg-surface-1/40 transition-[width] duration-200 ease-in-out"
      >
        <Sidebar collapsed={sidebarCollapsed} />
      </div>
      {!sidebarCollapsed && <ResizeHandle direction="horizontal" onResize={handleSidebarResize} />}

      <div className="flex min-w-0 flex-1">
        {/* Main content area */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border-subtle/75 bg-surface-1/40">
          {/* Center pane */}
          <div className="flex-1 overflow-hidden">{renderCenter()}</div>

          {/* Terminal */}
          {terminalOpen && (
            <>
              <ResizeHandle direction="vertical" onResize={handleTerminalResize} />
              <div style={{ height: paneMetrics.terminalDisplayHeight }} className="flex-shrink-0">
                <TerminalPanel />
              </div>
            </>
          )}
        </div>

        <ResizeHandle direction="horizontal" onResize={handleRightPaneResize} />

        {/* Right explorer pane */}
        <div
          style={{ width: paneMetrics.rightPaneDisplayWidth }}
          className="flex-shrink-0 overflow-hidden rounded-2xl border border-border-subtle/75 bg-surface-1/40"
        >
          <RightPane />
        </div>
      </div>
    </div>
  );
}
