import React, { useEffect, useState, useCallback } from 'react';
import {
  BookOpenCheck,
  ChevronDown,
  Folder,
  FolderOpen,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Sparkles,
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
  const { newChat, loadSession, activeSession } = useChat();
  const { openProject, selectProject } = useProject();

  const [sessionMap, setSessionMap] = useState<Record<string, Session[]>>({});
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    const loadSessions = async () => {
      const entries = await Promise.all(
        recentProjects.slice(0, 8).map(async (project) => {
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
  }, [recentProjects, activeSession]);

  useEffect(() => {
    if (!recentProjects.length) return;
    setExpandedProjects((prev) => {
      const next = { ...prev };
      recentProjects.forEach((project) => {
        if (next[project.id] === undefined) {
          next[project.id] = currentProject ? currentProject.id === project.id : false;
        }
      });
      return next;
    });
  }, [recentProjects, currentProject]);

  const handleNewChat = useCallback(() => {
    newChat();
    setActiveView('chat');
  }, [newChat, setActiveView]);

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
              className="rounded-xl p-2.5 text-text-muted hover:bg-surface-3 hover:text-text-primary transition-colors"
            >
              <Plus size={17} />
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
              className={`rounded-xl p-2.5 transition-colors ${
                activeView === 'settings'
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-muted hover:bg-surface-3 hover:text-text-primary'
              }`}
            >
              <Settings size={17} />
            </button>
          </Tooltip>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col border-r border-border-subtle bg-surface-1 px-4 pb-4">
      <div className="h-9 flex-shrink-0 [-webkit-app-region:drag]" />

      {/* Primary actions */}
      <div className="space-y-1 pb-4">
        <button
          onClick={handleNewChat}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-text-secondary hover:bg-surface-3 hover:text-text-primary transition-colors"
        >
          <Plus size={15} className="shrink-0" />
          New thread
        </button>
        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-text-secondary hover:bg-surface-3 hover:text-text-primary transition-colors">
          <Workflow size={15} className="shrink-0" />
          Automations
        </button>
        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-text-secondary hover:bg-surface-3 hover:text-text-primary transition-colors">
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
      <div className="flex-1 space-y-2 overflow-y-auto pr-0.5">
        {recentProjects.length === 0 && (
          <button
            onClick={openProject}
            className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border-default px-3 py-3 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary transition-colors"
          >
            <FolderOpen size={14} />
            Open project
          </button>
        )}

        {recentProjects.map((project) => {
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
                <div className="border-t border-border-subtle/50 px-2 pb-2.5 pt-2 space-y-0.5">
                  {sessions.length === 0 && (
                    <p className="px-2.5 py-2.5 text-xs text-text-muted italic">No threads yet</p>
                  )}

                  {sessions.slice(0, 7).map((session) => (
                    <button
                      key={session.id}
                      onClick={() => {
                        loadSession(session.id);
                        setActiveView('chat');
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-[13px] transition-colors ${
                        activeSession?.id === session.id
                          ? 'bg-accent/10 text-text-primary'
                          : 'text-text-secondary hover:bg-surface-3/80 hover:text-text-primary'
                      }`}
                    >
                      <MessageSquare size={12} className="shrink-0 opacity-60" />
                      <span className="min-w-0 flex-1 truncate">{session.title}</span>
                      <span className="shrink-0 text-[11px] text-text-muted tabular-nums">
                        {toRelativeTime(session.updatedAt)}
                      </span>
                    </button>
                  ))}

                  {sessions.length > 7 && (
                    <button className="w-full px-2.5 py-1.5 text-left text-xs text-text-muted hover:text-text-secondary transition-colors">
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

      {/* Upgrade prompt */}
      <button className="mt-2.5 flex w-full items-center gap-2 rounded-xl border border-border-default/80 bg-surface-0/60 px-3 py-2.5 text-xs text-text-secondary hover:bg-surface-3 hover:text-text-primary transition-colors">
        <Sparkles size={12} className="shrink-0 text-accent" />
        <span className="flex-1 text-left font-medium">Upgrade plan</span>
        <span className="text-[11px] font-semibold text-success tabular-nums">+17,824</span>
      </button>
    </div>
  );
}
