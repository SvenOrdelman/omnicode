import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DiffEditor as MonacoDiffEditor } from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { FileCode2, Loader2, MessageSquarePlus, RefreshCw, Save } from 'lucide-react';
import { useProjectStore } from '../../stores/project.store';
import { ipc } from '../../lib/ipc-client';
import { useChat } from '../../hooks/useChat';
import { useUIStore } from '../../stores/ui.store';
import { ResizeHandle } from '../layout/ResizeHandle';

interface ChangedFile {
  path: string;
  status: string;
  staged: string;
  unstaged: string;
}

interface GitFileView {
  content: string;
  baseContent: string;
  addedLines: number[];
  removedLines: number[];
  source: 'working_tree' | 'head';
}

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'xml',
  htm: 'xml',
  md: 'markdown',
  py: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  c: 'c',
  h: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  rb: 'ruby',
  sh: 'bash',
  zsh: 'bash',
  bash: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  sql: 'sql',
  xml: 'xml',
  vue: 'xml',
};

function languageFromFilePath(filePath: string | null): string | undefined {
  if (!filePath) return undefined;
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.d.ts')) return 'typescript';

  const dotIndex = lower.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === lower.length - 1) return undefined;

  const extension = lower.slice(dotIndex + 1);
  return LANGUAGE_BY_EXTENSION[extension];
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'added':
      return 'bg-success/15 text-success';
    case 'deleted':
      return 'bg-danger/15 text-danger';
    case 'renamed':
      return 'bg-warning/15 text-warning';
    case 'untracked':
      return 'bg-accent/15 text-accent';
    default:
      return 'bg-surface-3 text-text-secondary';
  }
}

function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, '\n');
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function extractLineContext(content: string, lineNumber: number): {
  lineText: string;
  contextSnippet: string;
  startLine: number;
  endLine: number;
} {
  const lines = normalizeLineEndings(content).split('\n');
  if (lines.length === 0) {
    return {
      lineText: '',
      contextSnippet: '(no context available)',
      startLine: 1,
      endLine: 1,
    };
  }

  const safeLine = Math.min(Math.max(lineNumber, 1), lines.length);
  const startLine = Math.max(1, safeLine - 2);
  const endLine = Math.min(lines.length, safeLine + 2);
  const contextSnippet = lines
    .slice(startLine - 1, endLine)
    .map((line, index) => {
      const currentLine = startLine + index;
      const marker = currentLine === safeLine ? '>' : ' ';
      return `${marker} ${String(currentLine).padStart(4, ' ')} | ${line}`;
    })
    .join('\n');

  return {
    lineText: lines[safeLine - 1] ?? '',
    contextSnippet,
    startLine,
    endLine,
  };
}

export function RightPane() {
  const DEFAULT_VISIBLE_FILE_ROWS = 5;
  const FILE_ROW_HEIGHT = 36;
  const FILE_LIST_MIN_HEIGHT = 110;
  const FILE_VIEW_MIN_HEIGHT = 180;
  const SPLIT_HANDLE_HEIGHT = 10;
  const DEFAULT_FILE_LIST_HEIGHT = DEFAULT_VISIBLE_FILE_ROWS * FILE_ROW_HEIGHT;

  const currentProject = useProjectStore((s) => s.currentProject);
  const { sendPrompt } = useChat();
  const setActiveView = useUIStore((s) => s.setActiveView);

  const [changes, setChanges] = useState<ChangedFile[]>([]);
  const [selectedChangeFile, setSelectedChangeFile] = useState<string | null>(null);
  const [fileView, setFileView] = useState<GitFileView | null>(null);
  const [editorDraft, setEditorDraft] = useState('');
  const [editorBaseContent, setEditorBaseContent] = useState('');
  const [loadingChanges, setLoadingChanges] = useState(false);
  const [loadingFileView, setLoadingFileView] = useState(false);
  const [savingFileEdit, setSavingFileEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changesListHeight, setChangesListHeight] = useState(DEFAULT_FILE_LIST_HEIGHT);
  const [splitContainerHeight, setSplitContainerHeight] = useState(0);

  const diffEditorRef = useRef<MonacoEditor.IStandaloneDiffEditor | null>(null);
  const modifiedContentSubscriptionRef = useRef<{ dispose: () => void } | null>(null);
  const saveFileEditRef = useRef<() => void>(() => undefined);
  const lastAutoRefreshAtRef = useRef(0);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);

  const canEditSelectedFile = useMemo(
    () => Boolean(selectedChangeFile && fileView && fileView.source === 'working_tree'),
    [fileView, selectedChangeFile]
  );
  const hasUnsavedEdit = canEditSelectedFile && editorDraft !== editorBaseContent;
  const lockNavigation = hasUnsavedEdit || savingFileEdit;
  const selectedLanguage = languageFromFilePath(selectedChangeFile);
  const maxChangesListHeight = useMemo(() => {
    if (splitContainerHeight <= 0) {
      return DEFAULT_FILE_LIST_HEIGHT;
    }

    return Math.max(FILE_LIST_MIN_HEIGHT, splitContainerHeight - FILE_VIEW_MIN_HEIGHT - SPLIT_HANDLE_HEIGHT);
  }, [DEFAULT_FILE_LIST_HEIGHT, splitContainerHeight]);

  const loadChanges = useCallback(async () => {
    if (!currentProject) return;
    setLoadingChanges(true);
    setError(null);

    try {
      const projectChanges: ChangedFile[] = await ipc().listGitChanges(currentProject.path);
      setChanges(projectChanges);
      setSelectedChangeFile((previous) => {
        if (previous) return previous;
        return projectChanges[0]?.path ?? null;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load git changes');
      setChanges([]);
    } finally {
      setLoadingChanges(false);
    }
  }, [currentProject]);

  const loadGitFileView = useCallback(async (cwd: string, filePath: string): Promise<GitFileView> => {
    try {
      return await ipc().getGitFileView({ cwd, filePath });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("No handler registered for 'git:get-file-view'")) {
        throw err;
      }

      const fallback = await ipc().getGitDiff({ cwd, filePath }).catch(() => 'Diff preview is unavailable.');
      return {
        content: fallback,
        baseContent: '',
        addedLines: [],
        removedLines: [],
        source: 'working_tree',
      };
    }
  }, []);

  useEffect(() => {
    if (!currentProject) {
      setChanges([]);
      setSelectedChangeFile(null);
      setFileView(null);
      setEditorDraft('');
      setEditorBaseContent('');
      setChangesListHeight(DEFAULT_FILE_LIST_HEIGHT);
      return;
    }

    loadChanges().catch(() => undefined);
  }, [currentProject, loadChanges]);

  const refreshOnWindowActive = useCallback(async () => {
    if (!currentProject || lockNavigation) return;

    try {
      const updatedChanges: ChangedFile[] = await ipc().listGitChanges(currentProject.path);
      setChanges(updatedChanges);

      const activeFile = selectedChangeFile || updatedChanges[0]?.path || null;
      if (!selectedChangeFile && activeFile) {
        setSelectedChangeFile(activeFile);
      }

      if (!activeFile) {
        setFileView(null);
        setEditorDraft('');
        setEditorBaseContent('');
        return;
      }

      const refreshedView: GitFileView = await loadGitFileView(currentProject.path, activeFile);
      setFileView(refreshedView);
      setEditorDraft(refreshedView.content);
      setEditorBaseContent(refreshedView.content);
    } catch {
      // Ignore background refresh errors to avoid noisy banners on focus changes.
    }
  }, [currentProject, loadGitFileView, lockNavigation, selectedChangeFile]);

  useEffect(() => {
    const AUTO_REFRESH_THROTTLE_MS = 250;

    const maybeRefresh = () => {
      const now = Date.now();
      if (now - lastAutoRefreshAtRef.current < AUTO_REFRESH_THROTTLE_MS) return;
      lastAutoRefreshAtRef.current = now;
      refreshOnWindowActive().catch(() => undefined);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        maybeRefresh();
      }
    };

    window.addEventListener('focus', maybeRefresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', maybeRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshOnWindowActive]);

  useEffect(() => {
    if (!currentProject || !selectedChangeFile) {
      setFileView(null);
      setEditorDraft('');
      setEditorBaseContent('');
      return;
    }

    setLoadingFileView(true);
    loadGitFileView(currentProject.path, selectedChangeFile)
      .then((view: GitFileView) => {
        setFileView(view);
        setEditorDraft(view.content);
        setEditorBaseContent(view.content);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load file view');
        setFileView(null);
        setEditorDraft('');
        setEditorBaseContent('');
      })
      .finally(() => setLoadingFileView(false));
  }, [currentProject, loadGitFileView, selectedChangeFile]);

  const selectChangeFile = useCallback(
    (filePath: string) => {
      if (filePath === selectedChangeFile) return;
      if (hasUnsavedEdit) {
        const shouldDiscard = window.confirm('Discard unsaved edits before switching files?');
        if (!shouldDiscard) return;
      }

      setSelectedChangeFile(filePath);
    },
    [hasUnsavedEdit, selectedChangeFile]
  );

  const sendLineCommentToChat = useCallback(
    (lineNumber: number, sourceContent: string) => {
      if (!selectedChangeFile) return;

      const comment = window.prompt(`Comment for ${selectedChangeFile}:${lineNumber}`);
      if (!comment || !comment.trim()) return;

      const { lineText, contextSnippet, startLine, endLine } = extractLineContext(sourceContent, lineNumber);
      setActiveView('chat');
      const prompt = [
        `Please apply a change in file \`${selectedChangeFile}\` near line ${lineNumber}.`,
        `Target line content: ${lineText || '(empty line)'}`,
        `Context lines ${startLine}-${endLine} (the line prefixed with ">" is the target):`,
        '```text',
        contextSnippet,
        '```',
        `Requested change: ${comment.trim()}`,
        'Update the file accordingly and summarize exactly what changed.',
      ].join('\n');
      sendPrompt(prompt).catch(() => undefined);
    },
    [selectedChangeFile, sendPrompt, setActiveView]
  );

  const commentCurrentEditorLine = useCallback(() => {
    if (!selectedChangeFile) return;
    const modifiedEditor = diffEditorRef.current?.getModifiedEditor();
    const activeLine = modifiedEditor?.getPosition()?.lineNumber ?? 1;
    sendLineCommentToChat(activeLine, editorDraft || fileView?.content || '');
  }, [editorDraft, fileView?.content, selectedChangeFile, sendLineCommentToChat]);

  const saveFullFileEdit = useCallback(async () => {
    if (!currentProject || !selectedChangeFile || !canEditSelectedFile || !hasUnsavedEdit || savingFileEdit) return;

    const nextContent = editorDraft;
    setSavingFileEdit(true);
    setError(null);

    try {
      await ipc().writeProjectFile({
        cwd: currentProject.path,
        filePath: selectedChangeFile,
        content: nextContent,
      });

      // Keep editor models and cursor stable; only mark current content as saved.
      setEditorBaseContent(nextContent);
      setFileView((previous) => (previous ? { ...previous, content: nextContent } : previous));

      const updatedChanges = await ipc().listGitChanges(currentProject.path);
      setChanges(updatedChanges);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save file edits');
    } finally {
      setSavingFileEdit(false);
    }
  }, [
    canEditSelectedFile,
    currentProject,
    editorBaseContent,
    editorDraft,
    hasUnsavedEdit,
    savingFileEdit,
    selectedChangeFile,
  ]);

  useEffect(() => {
    saveFileEditRef.current = () => {
      saveFullFileEdit().catch(() => undefined);
    };
  }, [saveFullFileEdit]);

  useEffect(() => {
    const handleSaveEvent: EventListener = () => {
      saveFileEditRef.current();
    };
    window.addEventListener('omnicode:save-active-editor', handleSaveEvent);
    return () => {
      window.removeEventListener('omnicode:save-active-editor', handleSaveEvent);
    };
  }, []);

  const handleDiffEditorMount = useCallback(
    (editor: MonacoEditor.IStandaloneDiffEditor, monaco: typeof import('monaco-editor')) => {
      diffEditorRef.current = editor;
      const modifiedEditor = editor.getModifiedEditor();
      modifiedEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        saveFileEditRef.current();
      });
      modifiedContentSubscriptionRef.current?.dispose();
      modifiedContentSubscriptionRef.current = modifiedEditor.onDidChangeModelContent(() => {
        setEditorDraft(modifiedEditor.getValue());
      });
    },
    []
  );

  useEffect(
    () => () => {
      modifiedContentSubscriptionRef.current?.dispose();
      modifiedContentSubscriptionRef.current = null;
      diffEditorRef.current = null;
    },
    []
  );

  useEffect(() => {
    if (!splitContainerRef.current) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      setSplitContainerHeight(entry.contentRect.height);
    });
    observer.observe(splitContainerRef.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setChangesListHeight((previous) => clamp(previous, FILE_LIST_MIN_HEIGHT, maxChangesListHeight));
  }, [maxChangesListHeight]);

  const handleChangesListResize = useCallback(
    (delta: number) => {
      setChangesListHeight(Math.round(clamp(changesListHeight + delta, FILE_LIST_MIN_HEIGHT, maxChangesListHeight)));
    },
    [changesListHeight, maxChangesListHeight]
  );

  const diffEditorOptions = useMemo<MonacoEditor.IStandaloneDiffEditorConstructionOptions>(
    () => ({
      automaticLayout: true,
      renderSideBySide: false,
      originalEditable: false,
      readOnly: !canEditSelectedFile,
      minimap: { enabled: false },
      fontSize: 13,
      lineHeight: 20,
      lineNumbersMinChars: 3,
      lineDecorationsWidth: 8,
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      tabSize: 2,
      insertSpaces: true,
      ignoreTrimWhitespace: false,
      renderIndicators: true,
      glyphMargin: true,
      renderMarginRevertIcon: true,
      folding: false,
      enableSplitViewResizing: true,
      fontFamily: `'SF Mono', Menlo, Monaco, 'Cascadia Mono', monospace`,
    }),
    [canEditSelectedFile]
  );

  return (
    <div className="flex h-full flex-col bg-surface-1/90">
      <div className="border-b border-border-subtle px-3 py-2.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Changes</p>
          <button
            onClick={() => {
              if (lockNavigation) return;
              loadChanges().catch(() => undefined);
            }}
            disabled={lockNavigation}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>

      {!currentProject && (
        <div className="m-3 rounded-xl border border-border-subtle bg-surface-0/70 p-3 text-sm text-text-secondary">
          Open a project to view git changes.
        </div>
      )}

      {currentProject && (
        <div ref={splitContainerRef} className="flex min-h-0 flex-1 flex-col">
          <div
            style={{ height: changesListHeight }}
            className="shrink-0 overflow-y-auto border-b border-border-subtle"
          >
            {loadingChanges && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-text-muted">
                <Loader2 size={14} className="animate-spin" />
                Loading changes...
              </div>
            )}
            {!loadingChanges && changes.length === 0 && (
              <p className="px-3 py-2 text-sm text-text-muted">No local changes detected.</p>
            )}
            {!loadingChanges &&
              changes.map((change) => (
                <button
                  key={change.path}
                  onClick={() => selectChangeFile(change.path)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${
                    selectedChangeFile === change.path
                      ? 'bg-accent-muted/60 text-text-primary'
                      : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
                  }`}
                >
                  <FileCode2 size={13} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm">{change.path}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${statusBadgeClass(change.status)}`}>
                    {change.status}
                  </span>
                </button>
              ))}
          </div>

          <ResizeHandle direction="vertical" onResize={handleChangesListResize} />

          <div className="min-h-0 flex-1 p-3">
            <div className="flex h-full min-h-0 flex-col">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs text-text-muted">{selectedChangeFile || 'No file selected'}</p>
                  {fileView?.source === 'head' && (
                    <p className="text-[11px] text-warning">File is deleted in working tree (read-only diff view)</p>
                  )}
                  {hasUnsavedEdit && <p className="text-[11px] text-warning">Unsaved file edits</p>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={commentCurrentEditorLine}
                    disabled={!canEditSelectedFile || !fileView || savingFileEdit}
                    className="inline-flex items-center gap-1 rounded-md border border-border-default px-2 py-1 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-45"
                    title="Send current line context to chat"
                  >
                    <MessageSquarePlus size={12} />
                    Comment Line
                  </button>
                  <button
                    onClick={() => saveFullFileEdit().catch(() => undefined)}
                    disabled={!hasUnsavedEdit || savingFileEdit || !canEditSelectedFile}
                    className="inline-flex items-center gap-1 rounded-md border border-border-default px-2 py-1 text-xs text-text-secondary transition-colors hover:border-success/55 hover:text-success disabled:cursor-not-allowed disabled:opacity-45"
                    title="Save file (Ctrl/Cmd+S)"
                  >
                    {savingFileEdit ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    Save
                  </button>
                  {loadingFileView && <Loader2 size={14} className="animate-spin text-text-muted" />}
                </div>
              </div>

              <div className="min-h-0 flex-1">
                {fileView ? (
                  <div className="h-full overflow-hidden rounded-xl border border-border-subtle bg-surface-0/80">
                    <MonacoDiffEditor
                      key={selectedChangeFile || 'diff-editor'}
                      original={fileView.baseContent}
                      modified={editorDraft}
                      language={selectedLanguage}
                      theme="vs-dark"
                      options={diffEditorOptions}
                      onMount={handleDiffEditorMount}
                      loading={
                        <div className="flex h-full items-center justify-center text-sm text-text-muted">
                          Loading editor...
                        </div>
                      }
                    />
                  </div>
                ) : (
                  <p className="rounded-xl border border-border-subtle bg-surface-0/70 p-3 text-sm text-text-muted">
                    Select a changed file to view and edit its diff.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {error && <p className="border-t border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
