import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileCode2, FileSearch, GitCompareArrows, Loader2, RefreshCw, Search } from 'lucide-react';
import { useProjectStore } from '../../stores/project.store';
import { ipc } from '../../lib/ipc-client';

type ExplorerTab = 'files' | 'changes';

interface ChangedFile {
  path: string;
  status: string;
  staged: string;
  unstaged: string;
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

function DiffView({ diff }: { diff: string }) {
  const lines = diff.split('\n');
  return (
    <div className="overflow-auto rounded-xl border border-border-subtle bg-surface-0/70 p-2">
      <div className="font-mono text-[12px] leading-5">
        {lines.map((line, index) => {
          const key = `${index}-${line}`;
          const isAdded = line.startsWith('+') && !line.startsWith('+++');
          const isRemoved = line.startsWith('-') && !line.startsWith('---');
          const isMeta = line.startsWith('@@') || line.startsWith('diff --git') || line.startsWith('###');

          return (
            <div
              key={key}
              className={`whitespace-pre px-1.5 ${
                isAdded
                  ? 'bg-success/8 text-success'
                  : isRemoved
                    ? 'bg-danger/8 text-danger'
                    : isMeta
                      ? 'text-accent'
                      : 'text-text-secondary'
              }`}
            >
              {line || ' '}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RightPane() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const [tab, setTab] = useState<ExplorerTab>('files');
  const [fileQuery, setFileQuery] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [changes, setChanges] = useState<ChangedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedChangeFile, setSelectedChangeFile] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<string>('');
  const [filePreviewTruncated, setFilePreviewTruncated] = useState(false);
  const [diffPreview, setDiffPreview] = useState<string>('');
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingChanges, setLoadingChanges] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredFiles = useMemo(() => {
    const query = fileQuery.trim().toLowerCase();
    if (!query) return files;
    return files.filter((file) => file.toLowerCase().includes(query));
  }, [files, fileQuery]);

  const loadFiles = useCallback(async () => {
    if (!currentProject) return;
    setLoadingFiles(true);
    setError(null);
    try {
      const projectFiles: string[] = await ipc().listProjectFiles(currentProject.path);
      setFiles(projectFiles);
      setSelectedFile((prev) => {
        if (prev && projectFiles.includes(prev)) return prev;
        return projectFiles[0] ?? null;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
      setFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  }, [currentProject]);

  const loadChanges = useCallback(async () => {
    if (!currentProject) return;
    setLoadingChanges(true);
    setError(null);
    try {
      const projectChanges: ChangedFile[] = await ipc().listGitChanges(currentProject.path);
      setChanges(projectChanges);
      setSelectedChangeFile((prev) => {
        if (prev && projectChanges.some((change) => change.path === prev)) return prev;
        return projectChanges[0]?.path ?? null;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load git changes');
      setChanges([]);
    } finally {
      setLoadingChanges(false);
    }
  }, [currentProject]);

  useEffect(() => {
    if (!currentProject) {
      setFiles([]);
      setChanges([]);
      setSelectedFile(null);
      setSelectedChangeFile(null);
      setFilePreview('');
      setDiffPreview('');
      return;
    }

    loadFiles().catch(() => undefined);
    loadChanges().catch(() => undefined);
  }, [currentProject, loadFiles, loadChanges]);

  useEffect(() => {
    if (!currentProject || !selectedFile) {
      setFilePreview('');
      setFilePreviewTruncated(false);
      return;
    }

    setLoadingPreview(true);
    ipc()
      .readProjectFile({ cwd: currentProject.path, filePath: selectedFile })
      .then((result: { content: string; truncated: boolean }) => {
        setFilePreview(result.content);
        setFilePreviewTruncated(result.truncated);
      })
      .catch((err: unknown) => {
        setFilePreview(err instanceof Error ? err.message : 'Failed to open file');
        setFilePreviewTruncated(false);
      })
      .finally(() => setLoadingPreview(false));
  }, [currentProject, selectedFile]);

  useEffect(() => {
    if (!currentProject || !selectedChangeFile) {
      setDiffPreview('');
      return;
    }

    setLoadingDiff(true);
    ipc()
      .getGitDiff({ cwd: currentProject.path, filePath: selectedChangeFile })
      .then((diff: string) => setDiffPreview(diff))
      .catch((err: unknown) => {
        setDiffPreview(err instanceof Error ? err.message : 'Failed to load diff');
      })
      .finally(() => setLoadingDiff(false));
  }, [currentProject, selectedChangeFile]);

  return (
    <div className="flex h-full flex-col bg-surface-1/90">
      <div className="border-b border-border-subtle px-3 py-2.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Explorer</p>
          <button
            onClick={() => {
              if (tab === 'files') {
                loadFiles().catch(() => undefined);
                return;
              }
              loadChanges().catch(() => undefined);
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted hover:bg-surface-3 hover:text-text-primary transition-colors"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>

        <div className="mt-2 inline-flex rounded-lg border border-border-default bg-surface-2 p-1">
          <button
            onClick={() => setTab('files')}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              tab === 'files' ? 'bg-surface-3 text-text-primary' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <FileSearch size={13} />
            Files
          </button>
          <button
            onClick={() => setTab('changes')}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              tab === 'changes' ? 'bg-surface-3 text-text-primary' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <GitCompareArrows size={13} />
            Changes
          </button>
        </div>
      </div>

      {!currentProject && (
        <div className="m-3 rounded-xl border border-border-subtle bg-surface-0/70 p-3 text-sm text-text-secondary">
          Open a project to browse files and view diffs.
        </div>
      )}

      {currentProject && tab === 'files' && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-border-subtle p-3">
            <label className="relative block">
              <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-text-muted" />
              <input
                value={fileQuery}
                onChange={(event) => setFileQuery(event.target.value)}
                placeholder="Search files in current project"
                className="w-full rounded-lg border border-border-default bg-surface-0 py-2 pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-border-strong"
              />
            </label>
          </div>

          <div className="min-h-0 overflow-y-auto border-b border-border-subtle">
            {loadingFiles && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-text-muted">
                <Loader2 size={14} className="animate-spin" />
                Loading files...
              </div>
            )}
            {!loadingFiles && filteredFiles.length === 0 && (
              <p className="px-3 py-2 text-sm text-text-muted">No files found.</p>
            )}
            {!loadingFiles &&
              filteredFiles.slice(0, 400).map((filePath) => (
                <button
                  key={filePath}
                  onClick={() => setSelectedFile(filePath)}
                  className={`block w-full truncate px-3 py-1.5 text-left text-sm transition-colors ${
                    selectedFile === filePath
                      ? 'bg-accent-muted text-text-primary'
                      : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
                  }`}
                  title={filePath}
                >
                  {filePath}
                </button>
              ))}
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs text-text-muted">{selectedFile || 'No file selected'}</p>
              {loadingPreview && <Loader2 size={14} className="animate-spin text-text-muted" />}
            </div>
            <div className="overflow-auto rounded-xl border border-border-subtle bg-surface-0/70 p-2">
              <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-5 text-text-secondary">
                {filePreview || 'Select a file to preview content.'}
              </pre>
            </div>
            {filePreviewTruncated && (
              <p className="mt-2 text-xs text-text-muted">Preview truncated to the first 512KB.</p>
            )}
          </div>
        </div>
      )}

      {currentProject && tab === 'changes' && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 overflow-y-auto border-b border-border-subtle">
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
                  onClick={() => setSelectedChangeFile(change.path)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${
                    selectedChangeFile === change.path
                      ? 'bg-accent-muted text-text-primary'
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

          <div className="min-h-0 flex-1 overflow-auto p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs text-text-muted">{selectedChangeFile || 'No file selected'}</p>
              {loadingDiff && <Loader2 size={14} className="animate-spin text-text-muted" />}
            </div>
            {diffPreview ? (
              <DiffView diff={diffPreview} />
            ) : (
              <p className="rounded-xl border border-border-subtle bg-surface-0/70 p-3 text-sm text-text-muted">
                Select a changed file to view the diff.
              </p>
            )}
          </div>
        </div>
      )}

      {error && <p className="border-t border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
