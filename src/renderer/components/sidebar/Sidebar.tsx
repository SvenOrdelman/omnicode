import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Archive,
  BookOpenCheck,
  Check,
  ChevronDown,
  Folder,
  FolderOpen,
  Loader2,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Terminal,
  Workflow,
} from 'lucide-react';
import { useProjectStore } from '../../stores/project.store';
import { useUIStore } from '../../stores/ui.store';
import { useChat } from '../../hooks/useChat';
import { useProject } from '../../hooks/useProject';
import { ipc } from '../../lib/ipc-client';
import { Tooltip } from '../common/Tooltip';
import type { Session } from '../../../shared/session-types';

interface SidebarProps {
  collapsed?: boolean;
}

function toRelativeTime(timestamp: number): string {
  const minutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const recentProjects = useProjectStore((s) => s.recentProjects);
  const { activeView, setActiveView, terminalOpen, toggleTerminal, setSidebarCollapsed } = useUIStore();
  const { newChat, loadSession, activeSession, archiveSession, sessionStatusById, sessionCompletedById } = useChat();
  const { openProject, selectProject } = useProject();

  const [sessionMap, setSessionMap] = useState<Record<string, Session[]>>({});
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const sortedProjects = useMemo(
    () =>
      [...recentProjects].sort((a, b) => {
        const byName = a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
        if (byName !== 0) return byName;
        return a.path.localeCompare(b.path, undefined, { sensitivity: 'base', numeric: true });
      }),
    [recentProjects]
  );

  useEffect(() => {
    let cancelled = false;

    const loadSessions = async () => {
      const entries = await Promise.all(
        sortedProjects.slice(0, 8).map(async (project) => {
          try {
            const sessions = await ipc().listSessions(project.id);
            return [project.id, sessions as Session[]] as const;
          } catch {
            return [project.id, []] as const;
          }
        })
      );

      if (!cancelled) {
        setSessionMap(Object.fromEntries(entries));
      }
    };

    loadSessions().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [sortedProjects, activeSession]);

  useEffect(() => {
    if (!sortedProjects.length) return;
    setExpandedProjects((prev) => {
      const next = { ...prev };
      sortedProjects.forEach((project) => {
        if (next[project.id] === undefined) {
          next[project.id] = currentProject ? currentProject.id === project.id : false;
        }
      });
      return next;
    });
  }, [sortedProjects, currentProject]);

  const handleNewChat = useCallback(() => {
    newChat();
    setActiveView('chat');
  }, [newChat, setActiveView]);

  const handleOpenSession = useCallback(
    async (projectPath: string, sessionId: string) => {
      await selectProject(projectPath);
      await loadSession(sessionId);
      setActiveView('chat');
    },
    [loadSession, selectProject, setActiveView]
  );

  const primaryTabClass = (isActive: boolean) =>
    `flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-accent/10 text-accent'
        : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
    }`;

  const iconTabClass = (isActive: boolean) =>
    `rounded-xl p-2.5 transition-colors ${
      isActive
        ? 'bg-accent/10 text-accent'
        : 'text-text-muted hover:bg-surface-3 hover:text-text-primary'
    }`;

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  if (collapsed) {
    return (
      <div className="flex h-full w-14 flex-col items-center border-r border-border-subtle bg-surface-1 py-3">
        <div className="h-9 flex-shrink-0 [-webkit-app-region:drag]" />
        <Tooltip label="Expand sidebar">
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="rounded-xl p-2.5 text-text-muted hover:bg-surface-3 hover:text-text-primary transition-colors"
          >
            <PanelLeftOpen size={18} />
          </button>
        </Tooltip>

        <div className="mt-4 flex flex-col gap-2">
          <Tooltip label="New thread">
            <button
              onClick={handleNewChat}
              className={iconTabClass(activeView === 'chat')}
            >
              <Plus size={17} />
            </button>
          </Tooltip>
          <Tooltip label="Automations">
            <button
              onClick={() => setActiveView('automations')}
              className={iconTabClass(activeView === 'automations')}
            >
              <Workflow size={17} />
            </button>
          </Tooltip>
          <Tooltip label="Skills">
            <button
              onClick={() => setActiveView('skills')}
              className={iconTabClass(activeView === 'skills')}
            >
              <BookOpenCheck size={17} />
            </button>
          </Tooltip>
          <Tooltip label="Projects">
            <button
              onClick={openProject}
              className="rounded-xl p-2.5 text-text-muted hover:bg-surface-3 hover:text-text-primary transition-colors"
            >
              <FolderOpen size={17} />
            </button>
          </Tooltip>
          <Tooltip label="Terminal">
            <button
              onClick={toggleTerminal}
              className={`rounded-xl p-2.5 transition-colors ${
                terminalOpen ? 'bg-accent/10 text-accent' : 'text-text-muted hover:bg-surface-3 hover:text-text-primary'
              }`}
            >
              <Terminal size={17} />
            </button>
          </Tooltip>
        </div>

        <div className="mt-auto">
          <Tooltip label="Settings" side="top">
            <button
              onClick={() => setActiveView('settings')}
              className={iconTabClass(activeView === 'settings')}
            >
              <Settings size={17} />
            </button>
          </Tooltip>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col border-r border-border-subtle bg-surface-1 px-3 pb-4">
      <div className="h-9 flex-shrink-0 [-webkit-app-region:drag]" />

      {/* Primary actions */}
      <div className="space-y-1 pb-4">
        <button
          onClick={handleNewChat}
          className={primaryTabClass(activeView === 'chat')}
        >
          <Plus size={15} className="shrink-0" />
          New thread
        </button>
        <button
          onClick={() => setActiveView('automations')}
          className={primaryTabClass(activeView === 'automations')}
        >
          <Workflow size={15} className="shrink-0" />
          Automations
        </button>
        <button
          onClick={() => setActiveView('skills')}
          className={primaryTabClass(activeView === 'skills')}
        >
          <BookOpenCheck size={15} className="shrink-0" />
          Skills
        </button>
      </div>

      {/* Divider */}
      <div className="mb-4 border-t border-border-subtle" />

      {/* Threads section header */}
      <div className="mb-3 flex items-center justify-between px-1">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">Threads</p>
        <Tooltip label="Open project" side="top">
          <button
            onClick={openProject}
            className="rounded-lg p-1.5 text-text-muted hover:bg-surface-3 hover:text-text-primary transition-colors"
          >
            <FolderOpen size={13} />
          </button>
        </Tooltip>
      </div>

      {/* Project + session list */}
      <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
        {sortedProjects.length === 0 && (
          <button
            onClick={openProject}
            className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border-default px-3 py-3 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary transition-colors"
          >
            <FolderOpen size={14} />
            Open project
          </button>
        )}

        {sortedProjects.map((project) => {
          const sessions = sessionMap[project.id] || [];
          const expanded = expandedProjects[project.id] ?? false;
          const isCurrent = currentProject?.id === project.id;

          return (
            <div
              key={project.id}
              className="rounded-xl border border-border-subtle/60 bg-surface-0/50 overflow-hidden"
            >
              <button
                onClick={async () => {
                  await selectProject(project.path);
                  toggleProject(project.id);
                }}
                className="flex w-full items-center justify-between px-3 py-3 text-left text-sm hover:bg-surface-3/60 transition-colors"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  {isCurrent
                    ? <FolderOpen size={14} className="shrink-0 text-accent" />
                    : <Folder size={14} className="shrink-0 text-text-muted" />
                  }
                  <span className={`truncate font-medium ${isCurrent ? 'text-text-primary' : 'text-text-secondary'}`}>
                    {project.name}
                  </span>
                </span>
                <ChevronDown
                  size={13}
                  className={`shrink-0 text-text-muted transition-transform ${expanded ? '' : '-rotate-90'}`}
                />
              </button>

              {expanded && (
                <div className="space-y-1 border-t border-border-subtle/50 px-2 pb-3 pt-2.5">
                  {sessions.length === 0 && (
                    <p className="px-2.5 py-2.5 text-xs text-text-muted italic">No threads yet</p>
                  )}

                  {sessions.slice(0, 7).map((session) => {
                    const status = sessionStatusById[session.id] ?? 'idle';
                    const isStreaming = status === 'streaming';
                    const showCompleted = status !== 'streaming' && sessionCompletedById[session.id];

                    return (
                      <div
                        key={session.id}
                        className={`group relative flex items-center rounded-lg px-1 ${
                          activeSession?.id === session.id ? 'bg-accent/10' : ''
                        }`}
                      >
                        <button
                          onClick={() => {
                            handleOpenSession(project.path, session.id).catch(() => undefined);
                          }}
                          className={`flex w-full min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-2 text-left text-[13px] transition-colors ${
                            activeSession?.id === session.id
                              ? 'text-text-primary'
                              : 'text-text-secondary hover:bg-surface-3/80 hover:text-text-primary'
                          }`}
                        >
                          <MessageSquare size={12} className="shrink-0 opacity-60" />
                          <span className="min-w-0 flex-1 truncate">{session.title}</span>
                          <span className="inline-flex h-4 min-w-[1rem] shrink-0 items-center justify-center text-[11px] text-text-muted tabular-nums">
                            {isStreaming && <Loader2 size={12} className="animate-spin text-accent" />}
                            {showCompleted && <Check size={12} className="text-success" />}
                            {!isStreaming && !showCompleted && toRelativeTime(session.updatedAt)}
                          </span>
                        </button>
                        <button
                          onClick={async (event) => {
                            event.stopPropagation();
                            await archiveSession(session.id);
                            setSessionMap((prev) => ({
                              ...prev,
                              [project.id]: (prev[project.id] || []).filter((entry) => entry.id !== session.id),
                            }));
                          }}
                          className="pointer-events-none absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md bg-surface-1/90 text-text-muted opacity-0 transition-opacity hover:bg-surface-3 hover:text-text-primary group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
                          title="Archive thread"
                        >
                          <Archive size={11} />
                        </button>
                      </div>
                    );
                  })}

                  {sessions.length > 7 && (
                    <button className="w-full px-2.5 py-2 text-left text-xs text-text-muted hover:text-text-secondary transition-colors">
                      Show {sessions.length - 7} more…
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom bar */}
      <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-3 px-0.5">
        <Tooltip label="Collapse sidebar" side="top">
          <button
            onClick={() => setSidebarCollapsed(true)}
            className="rounded-xl p-2 text-text-muted hover:bg-surface-3 hover:text-text-primary transition-colors"
          >
            <PanelLeftClose size={15} />
          </button>
        </Tooltip>

        <div className="flex items-center gap-1">
          <Tooltip label="Terminal" side="top">
            <button
              onClick={toggleTerminal}
              className={`rounded-xl p-2 transition-colors ${
                terminalOpen ? 'bg-accent/10 text-accent' : 'text-text-muted hover:bg-surface-3 hover:text-text-primary'
              }`}
            >
              <Terminal size={15} />
            </button>
          </Tooltip>
          <Tooltip label="Settings" side="top">
            <button
              onClick={() => setActiveView('settings')}
              className={`rounded-xl p-2 transition-colors ${
                activeView === 'settings'
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-muted hover:bg-surface-3 hover:text-text-primary'
              }`}
            >
              <Settings size={15} />
            </button>
          </Tooltip>
        </div>
      </div>

    </div>
  );
}
