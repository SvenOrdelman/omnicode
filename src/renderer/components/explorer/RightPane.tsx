import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DiffEditor as MonacoDiffEditor } from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { FileCode2, History, Loader2, MessageSquarePlus, RefreshCw, Save } from 'lucide-react';
import { useProjectStore } from '../../stores/project.store';
import { ipc } from '../../lib/ipc-client';
import { useChat } from '../../hooks/useChat';
import { useUIStore } from '../../stores/ui.store';
import { ResizeHandle } from '../layout/ResizeHandle';
import { Modal } from '../common/Modal';
import { GitBranchSwitcher } from '../chat/GitBranchSwitcher';

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

interface GitBranchInfo {
  branches: string[];
  current: string | null;
}

interface GitHistoryEntry {
  hash: string;
  shortHash: string;
  authorName: string;
  authoredAt: string;
  subject: string;
}

type GitCommitFileStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'typechanged' | 'changed';

interface GitCommitFileChange {
  path: string;
  previousPath: string | null;
  status: GitCommitFileStatus;
  additions: number;
  deletions: number;
}

interface GitCommitFileView {
  content: string;
  baseContent: string;
}

type GitAction = 'commit' | 'push' | 'fetch';
type RightPaneTab = 'changes' | 'history';

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
    case 'copied':
      return 'bg-accent/15 text-accent';
    case 'typechanged':
      return 'bg-warning/20 text-warning';
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

function formatHistoryTimestamp(rawTimestamp: string): string {
  const date = new Date(rawTimestamp);
  if (Number.isNaN(date.getTime())) {
    return rawTimestamp;
  }

  return date.toLocaleString();
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
  const [selectedForCommit, setSelectedForCommit] = useState<Record<string, boolean>>({});
  const [selectedChangeFile, setSelectedChangeFile] = useState<string | null>(null);
  const [fileView, setFileView] = useState<GitFileView | null>(null);
  const [editorDraft, setEditorDraft] = useState('');
  const [editorBaseContent, setEditorBaseContent] = useState('');
  const [loadingChanges, setLoadingChanges] = useState(false);
  const [loadingFileView, setLoadingFileView] = useState(false);
  const [savingFileEdit, setSavingFileEdit] = useState(false);
  const [runningAction, setRunningAction] = useState<GitAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<RightPaneTab>('changes');
  const [commitDialogOpen, setCommitDialogOpen] = useState(false);
  const [pushDialogOpen, setPushDialogOpen] = useState(false);
  const [commitTitle, setCommitTitle] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [pushRemote, setPushRemote] = useState('origin');
  const [pushBranch, setPushBranch] = useState('');
  const [historyItems, setHistoryItems] = useState<GitHistoryEntry[]>([]);
  const [selectedHistoryCommit, setSelectedHistoryCommit] = useState<string | null>(null);
  const [historyFiles, setHistoryFiles] = useState<GitCommitFileChange[]>([]);
  const [selectedHistoryFilePath, setSelectedHistoryFilePath] = useState<string | null>(null);
  const [historyFileView, setHistoryFileView] = useState<GitCommitFileView | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingHistoryFiles, setLoadingHistoryFiles] = useState(false);
  const [loadingHistoryFileView, setLoadingHistoryFileView] = useState(false);
  const [changesListHeight, setChangesListHeight] = useState(DEFAULT_FILE_LIST_HEIGHT);
  const [splitContainerHeight, setSplitContainerHeight] = useState(0);

  const diffEditorRef = useRef<MonacoEditor.IStandaloneDiffEditor | null>(null);
  const modifiedContentSubscriptionRef = useRef<{ dispose: () => void } | null>(null);
  const saveFileEditRef = useRef<() => void>(() => undefined);
  const lastAutoRefreshAtRef = useRef(0);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const selectAllCheckboxRef = useRef<HTMLInputElement | null>(null);

  const canEditSelectedFile = useMemo(
    () => Boolean(selectedChangeFile && fileView && fileView.source === 'working_tree'),
    [fileView, selectedChangeFile]
  );
  const hasUnsavedEdit = canEditSelectedFile && editorDraft !== editorBaseContent;
  const selectedCommitPaths = useMemo(
    () => changes.filter((change) => selectedForCommit[change.path] !== false).map((change) => change.path),
    [changes, selectedForCommit]
  );
  const allCommitFilesSelected = changes.length > 0 && selectedCommitPaths.length === changes.length;
  const someCommitFilesSelected = selectedCommitPaths.length > 0 && !allCommitFilesSelected;
  const lockNavigation = hasUnsavedEdit || savingFileEdit || runningAction !== null;
  const selectedLanguage = languageFromFilePath(selectedChangeFile);
  const selectedHistoryItem = useMemo(
    () => historyItems.find((entry) => entry.hash === selectedHistoryCommit) ?? null,
    [historyItems, selectedHistoryCommit]
  );
  const selectedHistoryFile = useMemo(
    () => historyFiles.find((file) => file.path === selectedHistoryFilePath) ?? null,
    [historyFiles, selectedHistoryFilePath]
  );
  const selectedHistoryLanguage = languageFromFilePath(selectedHistoryFilePath);
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
      const [projectChanges, branchInfo]: [ChangedFile[], GitBranchInfo] = await Promise.all([
        ipc().listGitChanges(currentProject.path),
        ipc().listGitBranches(currentProject.path),
      ]);

      setChanges(projectChanges);
      setCurrentBranch(branchInfo.current);
      setSelectedChangeFile((previous) => {
        if (!projectChanges.length) return null;
        if (previous && projectChanges.some((change) => change.path === previous)) return previous;
        return projectChanges[0]?.path ?? null;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load git changes');
      setChanges([]);
      setSelectedChangeFile(null);
      setCurrentBranch(null);
    } finally {
      setLoadingChanges(false);
    }
  }, [currentProject]);

  const loadHistory = useCallback(async () => {
    if (!currentProject) return;
    setLoadingHistory(true);
    setError(null);

    try {
      const entries: GitHistoryEntry[] = await ipc().listGitHistory({ cwd: currentProject.path, limit: 80 });
      setHistoryItems(entries);
      setSelectedHistoryCommit((previous) => {
        if (!entries.length) return null;
        if (previous && entries.some((entry) => entry.hash === previous)) return previous;
        return entries[0]?.hash ?? null;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load git history');
      setHistoryItems([]);
      setSelectedHistoryCommit(null);
      setHistoryFiles([]);
      setSelectedHistoryFilePath(null);
      setHistoryFileView(null);
    } finally {
      setLoadingHistory(false);
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
      setSelectedForCommit({});
      setSelectedChangeFile(null);
      setFileView(null);
      setEditorDraft('');
      setEditorBaseContent('');
      setCurrentBranch(null);
      setActiveTab('changes');
      setCommitDialogOpen(false);
      setPushDialogOpen(false);
      setHistoryItems([]);
      setSelectedHistoryCommit(null);
      setHistoryFiles([]);
      setSelectedHistoryFilePath(null);
      setHistoryFileView(null);
      setChangesListHeight(DEFAULT_FILE_LIST_HEIGHT);
      return;
    }

    loadChanges().catch(() => undefined);
  }, [currentProject, loadChanges]);

  useEffect(() => {
    setSelectedForCommit((previous) => {
      const next: Record<string, boolean> = {};
      for (const change of changes) {
        next[change.path] = previous[change.path] ?? true;
      }
      return next;
    });
  }, [changes]);

  useEffect(() => {
    if (!currentProject || activeTab !== 'history') return;
    loadHistory().catch(() => undefined);
  }, [activeTab, currentProject, loadHistory]);

  useEffect(() => {
    if (!selectAllCheckboxRef.current) return;
    selectAllCheckboxRef.current.indeterminate = someCommitFilesSelected;
  }, [someCommitFilesSelected]);

  const refreshOnWindowActive = useCallback(async () => {
    if (!currentProject || lockNavigation) return;

    if (activeTab === 'history') {
      await loadHistory();
      return;
    }

    try {
      const [updatedChanges, branchInfo]: [ChangedFile[], GitBranchInfo] = await Promise.all([
        ipc().listGitChanges(currentProject.path),
        ipc().listGitBranches(currentProject.path),
      ]);
      setChanges(updatedChanges);
      setCurrentBranch(branchInfo.current);

      const activeFile = updatedChanges.some((change) => change.path === selectedChangeFile)
        ? selectedChangeFile
        : (updatedChanges[0]?.path ?? null);
      if (activeFile !== selectedChangeFile) {
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
  }, [activeTab, currentProject, loadGitFileView, loadHistory, lockNavigation, selectedChangeFile]);

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
    if (activeTab !== 'changes') return;
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
  }, [activeTab, currentProject, loadGitFileView, selectedChangeFile]);

  useEffect(() => {
    if (activeTab !== 'history') return;
    if (!currentProject || !selectedHistoryCommit) {
      setHistoryFiles([]);
      setSelectedHistoryFilePath(null);
      setHistoryFileView(null);
      return;
    }

    setLoadingHistoryFiles(true);
    ipc()
      .listGitCommitFiles({ cwd: currentProject.path, commit: selectedHistoryCommit })
      .then((files: GitCommitFileChange[]) => {
        setHistoryFiles(files);
        setSelectedHistoryFilePath((previous) => {
          if (!files.length) return null;
          if (previous && files.some((file) => file.path === previous)) return previous;
          return files[0]?.path ?? null;
        });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load changed files for commit');
        setHistoryFiles([]);
        setSelectedHistoryFilePath(null);
        setHistoryFileView(null);
      })
      .finally(() => setLoadingHistoryFiles(false));
  }, [activeTab, currentProject, selectedHistoryCommit]);

  useEffect(() => {
    if (activeTab !== 'history') return;
    if (!currentProject || !selectedHistoryCommit || !selectedHistoryFile) {
      setHistoryFileView(null);
      return;
    }

    setLoadingHistoryFileView(true);
    ipc()
      .getGitCommitFileView({
        cwd: currentProject.path,
        commit: selectedHistoryCommit,
        path: selectedHistoryFile.path,
        previousPath: selectedHistoryFile.previousPath,
        status: selectedHistoryFile.status,
      })
      .then((view: GitCommitFileView) => {
        setHistoryFileView(view);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load file changes');
        setHistoryFileView(null);
      })
      .finally(() => setLoadingHistoryFileView(false));
  }, [activeTab, currentProject, selectedHistoryCommit, selectedHistoryFile]);

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

  const selectHistoryCommit = useCallback((commitHash: string) => {
    setSelectedHistoryCommit(commitHash);
  }, []);

  const selectHistoryFile = useCallback((filePath: string) => {
    setSelectedHistoryFilePath(filePath);
  }, []);

  const toggleFileForCommit = useCallback((filePath: string, selected: boolean) => {
    setSelectedForCommit((previous) => ({
      ...previous,
      [filePath]: selected,
    }));
  }, []);

  const toggleAllFilesForCommit = useCallback(
    (selected: boolean) => {
      setSelectedForCommit((previous) => {
        const next = { ...previous };
        for (const change of changes) {
          next[change.path] = selected;
        }
        return next;
      });
    },
    [changes]
  );

  const openCommitDialog = useCallback(() => {
    if (lockNavigation || !currentProject) return;
    setCommitDialogOpen(true);
  }, [currentProject, lockNavigation]);

  const openPushDialog = useCallback(() => {
    if (lockNavigation || !currentProject) return;
    setPushBranch(currentBranch || '');
    setPushDialogOpen(true);
  }, [currentBranch, currentProject, lockNavigation]);

  const handleFetch = useCallback(async () => {
    if (!currentProject || lockNavigation) return;
    setRunningAction('fetch');
    setError(null);

    try {
      await ipc().fetchGitChanges(currentProject.path);
      await loadChanges();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch remote changes');
    } finally {
      setRunningAction(null);
    }
  }, [currentProject, loadChanges, lockNavigation]);

  const handleCommit = useCallback(async () => {
    if (!currentProject || lockNavigation) return;
    const title = commitTitle.trim();
    if (!title) {
      setError('Commit title is required.');
      return;
    }
    if (selectedCommitPaths.length === 0) {
      setError('Select at least one file to commit.');
      return;
    }

    setRunningAction('commit');
    setError(null);

    try {
      await ipc().commitGitChanges({
        cwd: currentProject.path,
        title,
        message: commitMessage.trim() || undefined,
        filePaths: selectedCommitPaths,
      });
      setCommitDialogOpen(false);
      setCommitTitle('');
      setCommitMessage('');
      await loadChanges();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create commit');
    } finally {
      setRunningAction(null);
    }
  }, [commitMessage, commitTitle, currentProject, loadChanges, lockNavigation, selectedCommitPaths]);

  const handlePush = useCallback(async () => {
    if (!currentProject || lockNavigation) return;
    setRunningAction('push');
    setError(null);

    try {
      await ipc().pushGitChanges({
        cwd: currentProject.path,
        remote: pushRemote.trim() || undefined,
        branch: pushBranch.trim() || undefined,
      });
      setPushDialogOpen(false);
      await loadChanges();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to push changes');
    } finally {
      setRunningAction(null);
    }
  }, [currentProject, loadChanges, lockNavigation, pushBranch, pushRemote]);

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
      if (activeTab !== 'changes') return;
      saveFullFileEdit().catch(() => undefined);
    };
  }, [activeTab, saveFullFileEdit]);

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

  const historyDiffEditorOptions = useMemo<MonacoEditor.IStandaloneDiffEditorConstructionOptions>(
    () => ({
      automaticLayout: true,
      renderSideBySide: false,
      originalEditable: false,
      readOnly: true,
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
      glyphMargin: false,
      renderMarginRevertIcon: false,
      folding: true,
      enableSplitViewResizing: true,
      fontFamily: `'SF Mono', Menlo, Monaco, 'Cascadia Mono', monospace`,
    }),
    []
  );

  return (
    <div className="flex h-full flex-col bg-surface-1/90">
      <div className="border-b border-border-subtle px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="inline-flex items-center rounded-lg border border-border-subtle bg-surface-2/80 p-0.5">
              <button
                onClick={() => setActiveTab('changes')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeTab === 'changes'
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
                }`}
                title="View current working tree changes"
              >
                <FileCode2 size={12} />
                Changes
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeTab === 'history'
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
                }`}
                title="Browse commit history for current branch"
              >
                <History size={12} />
                History
              </button>
            </div>
            <p className="text-[11px] text-text-muted">
              {activeTab === 'changes'
                ? `${selectedCommitPaths.length}/${changes.length} selected for commit`
                : `${historyItems.length} commit${historyItems.length === 1 ? '' : 's'} in history`}
              {currentBranch ? ` • ${currentBranch}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <GitBranchSwitcher />
            {activeTab === 'changes' && (
              <>
                <button
                  onClick={openCommitDialog}
                  disabled={lockNavigation || changes.length === 0}
                  className="inline-flex items-center gap-1 rounded-md border border-border-default px-2 py-1 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-45"
                  title="Create a commit from selected files"
                >
                  {runningAction === 'commit' ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Commit
                </button>
                <button
                  onClick={openPushDialog}
                  disabled={lockNavigation}
                  className="inline-flex items-center gap-1 rounded-md border border-border-default px-2 py-1 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-45"
                  title="Push committed changes to remote"
                >
                  {runningAction === 'push' ? <Loader2 size={12} className="animate-spin" /> : null}
                  Push
                </button>
                <button
                  onClick={() => {
                    handleFetch().catch(() => undefined);
                  }}
                  disabled={lockNavigation}
                  className="inline-flex items-center gap-1 rounded-md border border-border-default px-2 py-1 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-45"
                  title="Fetch updates from remote"
                >
                  {runningAction === 'fetch' ? <Loader2 size={12} className="animate-spin" /> : null}
                  Fetch
                </button>
              </>
            )}
            <button
              onClick={() => {
                if (lockNavigation) return;
                if (activeTab === 'changes') {
                  loadChanges().catch(() => undefined);
                } else {
                  loadHistory().catch(() => undefined);
                }
              }}
              disabled={lockNavigation}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-45"
              title={activeTab === 'changes' ? 'Refresh local git status' : 'Refresh commit history'}
            >
              <RefreshCw size={12} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {!currentProject && (
        <div className="m-3 rounded-xl border border-border-subtle bg-surface-0/70 p-3 text-sm text-text-secondary">
          Open a project to view git changes and commit history.
        </div>
      )}

      {currentProject && activeTab === 'changes' && (
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
            {!loadingChanges && changes.length > 0 && (
              <div className="flex items-center justify-between border-b border-border-subtle bg-surface-1/60 px-3 py-1.5 text-xs text-text-muted">
                <label className="inline-flex items-center gap-2">
                  <input
                    ref={selectAllCheckboxRef}
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-border-default bg-surface-2"
                    checked={allCommitFilesSelected}
                    onChange={(event) => toggleAllFilesForCommit(event.target.checked)}
                  />
                  Select all
                </label>
                <span>{selectedCommitPaths.length} selected</span>
              </div>
            )}
            {!loadingChanges &&
              changes.map((change) => (
                <div
                  key={change.path}
                  className={`flex items-center gap-2 px-3 py-2 transition-colors ${
                    selectedChangeFile === change.path
                      ? 'bg-accent-muted/60 text-text-primary'
                      : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 shrink-0 rounded border-border-default bg-surface-2"
                    checked={selectedForCommit[change.path] !== false}
                    onChange={(event) => toggleFileForCommit(change.path, event.target.checked)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Include ${change.path} in commit`}
                  />
                  <button
                    onClick={() => selectChangeFile(change.path)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <FileCode2 size={13} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-sm">{change.path}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${statusBadgeClass(change.status)}`}
                    >
                      {change.status}
                    </span>
                  </button>
                </div>
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

      {currentProject && activeTab === 'history' && (
        <div ref={splitContainerRef} className="flex min-h-0 flex-1 flex-col">
          <div
            style={{ height: changesListHeight }}
            className="shrink-0 overflow-y-auto border-b border-border-subtle"
          >
            {loadingHistory && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-text-muted">
                <Loader2 size={14} className="animate-spin" />
                Loading history...
              </div>
            )}
            {!loadingHistory && historyItems.length === 0 && (
              <p className="px-3 py-2 text-sm text-text-muted">No commits found for this branch.</p>
            )}
            {!loadingHistory &&
              historyItems.map((entry) => (
                <button
                  key={entry.hash}
                  onClick={() => selectHistoryCommit(entry.hash)}
                  className={`w-full border-b border-border-subtle px-3 py-2 text-left transition-colors ${
                    selectedHistoryCommit === entry.hash
                      ? 'bg-accent-muted/60 text-text-primary'
                      : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium uppercase text-text-muted">
                      {entry.shortHash}
                    </span>
                    <span className="truncate text-[10px] text-text-muted">{formatHistoryTimestamp(entry.authoredAt)}</span>
                  </div>
                  <p className="truncate text-sm">{entry.subject || '(no subject)'}</p>
                  <p className="truncate text-[11px] text-text-muted">{entry.authorName}</p>
                </button>
              ))}
          </div>

          <ResizeHandle direction="vertical" onResize={handleChangesListResize} />

          <div className="min-h-0 flex-1 p-3">
            <div className="flex h-full min-h-0 flex-col">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs text-text-muted">
                    {selectedHistoryItem
                      ? `${selectedHistoryItem.shortHash} • ${selectedHistoryItem.subject || '(no subject)'}`
                      : 'No commit selected'}
                  </p>
                  {selectedHistoryItem && (
                    <p className="truncate text-[11px] text-text-muted">
                      {selectedHistoryItem.authorName} • {formatHistoryTimestamp(selectedHistoryItem.authoredAt)}
                    </p>
                  )}
                </div>
                {(loadingHistoryFiles || loadingHistoryFileView) && (
                  <Loader2 size={14} className="animate-spin text-text-muted" />
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border-subtle bg-surface-0/80">
                <div className="flex h-full min-h-0">
                  <div className="w-72 shrink-0 overflow-y-auto border-r border-border-subtle bg-surface-1/60">
                    {!selectedHistoryCommit && (
                      <p className="px-3 py-3 text-sm text-text-muted">Select a commit to inspect its changed files.</p>
                    )}
                    {selectedHistoryCommit && loadingHistoryFiles && (
                      <div className="flex items-center gap-2 px-3 py-2 text-sm text-text-muted">
                        <Loader2 size={14} className="animate-spin" />
                        Loading changed files...
                      </div>
                    )}
                    {selectedHistoryCommit && !loadingHistoryFiles && historyFiles.length === 0 && (
                      <p className="px-3 py-3 text-sm text-text-muted">No changed files found for this commit.</p>
                    )}
                    {selectedHistoryCommit &&
                      !loadingHistoryFiles &&
                      historyFiles.map((file) => (
                        <button
                          key={file.path}
                          onClick={() => selectHistoryFile(file.path)}
                          className={`w-full border-b border-border-subtle px-3 py-2 text-left transition-colors ${
                            selectedHistoryFilePath === file.path
                              ? 'bg-accent-muted/60 text-text-primary'
                              : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
                          }`}
                        >
                          <div className="mb-1 flex items-center justify-between gap-1">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${statusBadgeClass(file.status)}`}
                            >
                              {file.status}
                            </span>
                            <div className="flex items-center gap-1 text-[10px] font-medium tabular-nums">
                              <span className="text-success">+{file.additions}</span>
                              <span className="text-danger">-{file.deletions}</span>
                            </div>
                          </div>
                          <p className="truncate text-xs text-text-primary">{file.path}</p>
                          {file.previousPath && file.previousPath !== file.path && (
                            <p className="truncate text-[10px] text-text-muted">{file.previousPath} → {file.path}</p>
                          )}
                        </button>
                      ))}
                  </div>

                  <div className="min-h-0 flex-1">
                    {selectedHistoryFile && historyFileView ? (
                      <MonacoDiffEditor
                        key={`${selectedHistoryCommit || 'commit'}:${selectedHistoryFile.path}`}
                        original={historyFileView.baseContent}
                        modified={historyFileView.content}
                        language={selectedHistoryLanguage}
                        theme="vs-dark"
                        options={historyDiffEditorOptions}
                        loading={
                          <div className="flex h-full items-center justify-center text-sm text-text-muted">
                            Loading file changes...
                          </div>
                        }
                      />
                    ) : (
                      <p className="p-3 text-sm text-text-muted">
                        {selectedHistoryCommit ? 'Select a changed file to view its diff.' : 'Select a commit to view changes.'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal open={commitDialogOpen} onClose={() => setCommitDialogOpen(false)} title="Commit Changes">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            handleCommit().catch(() => undefined);
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="commit-title" className="text-sm font-medium text-text-secondary">
              Title
            </label>
            <input
              id="commit-title"
              value={commitTitle}
              onChange={(event) => setCommitTitle(event.target.value)}
              placeholder="Short commit title"
              className="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/50"
              disabled={runningAction === 'commit'}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="commit-message" className="text-sm font-medium text-text-secondary">
              Message
            </label>
            <textarea
              id="commit-message"
              value={commitMessage}
              onChange={(event) => setCommitMessage(event.target.value)}
              placeholder="Optional commit description"
              rows={4}
              className="w-full resize-y rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/50"
              disabled={runningAction === 'commit'}
            />
          </div>
          <p className="text-xs text-text-muted">
            {selectedCommitPaths.length} file{selectedCommitPaths.length === 1 ? '' : 's'} will be included.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCommitDialogOpen(false)}
              className="rounded-md border border-border-default px-3 py-1.5 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
              disabled={runningAction === 'commit'}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-45"
              disabled={runningAction === 'commit' || selectedCommitPaths.length === 0 || !commitTitle.trim()}
            >
              {runningAction === 'commit' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Commit
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={pushDialogOpen} onClose={() => setPushDialogOpen(false)} title="Push Changes">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            handlePush().catch(() => undefined);
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="push-remote" className="text-sm font-medium text-text-secondary">
              Remote
            </label>
            <input
              id="push-remote"
              value={pushRemote}
              onChange={(event) => setPushRemote(event.target.value)}
              placeholder="origin"
              className="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/50"
              disabled={runningAction === 'push'}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="push-branch" className="text-sm font-medium text-text-secondary">
              Branch
            </label>
            <input
              id="push-branch"
              value={pushBranch}
              onChange={(event) => setPushBranch(event.target.value)}
              placeholder={currentBranch || 'Current tracking branch'}
              className="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/50"
              disabled={runningAction === 'push'}
            />
          </div>
          <p className="text-xs text-text-muted">
            Pushes your local commits to the configured remote. Leave fields empty to use git defaults.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPushDialogOpen(false)}
              className="rounded-md border border-border-default px-3 py-1.5 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
              disabled={runningAction === 'push'}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-45"
              disabled={runningAction === 'push'}
            >
              {runningAction === 'push' ? <Loader2 size={14} className="animate-spin" /> : null}
              Push
            </button>
          </div>
        </form>
      </Modal>

      {error && <p className="border-t border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
