import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import hljs from 'highlight.js/lib/common';
import { Check, Loader2, MessageSquarePlus, PencilLine, X } from 'lucide-react';

interface CodePanelProps {
  content: string;
  addedLines?: number[];
  removedLines?: number[];
  language?: string;
  focusLine?: number | null;
  editable?: boolean;
  onLineComment?: (lineNumber: number, lineText: string) => void;
  onLineEdit?: (payload: {
    lineNumber: number;
    previousLine: string;
    nextLine: string;
    nextContent: string;
  }) => Promise<void> | void;
}

function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, '\n');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function CodePanel({
  content,
  addedLines = [],
  removedLines = [],
  language,
  focusLine = null,
  editable = false,
  onLineComment,
  onLineEdit,
}: CodePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editingLine, setEditingLine] = useState<number | null>(null);
  const [draftLine, setDraftLine] = useState('');
  const [savingLine, setSavingLine] = useState<number | null>(null);
  const normalizedContent = useMemo(() => normalizeLineEndings(content), [content]);
  const lines = useMemo(() => normalizedContent.split('\n'), [normalizedContent]);
  const added = useMemo(() => new Set(addedLines), [addedLines]);
  const removed = useMemo(() => new Set(removedLines), [removedLines]);
  const activeLanguage = useMemo(() => {
    if (language && hljs.getLanguage(language)) return language;
    const detected = hljs.highlightAuto(normalizedContent).language;
    return detected && hljs.getLanguage(detected) ? detected : null;
  }, [language, normalizedContent]);
  const highlightedLines = useMemo(() => {
    const shouldHighlight = lines.length <= 5000 && normalizedContent.length <= 500_000;
    if (!shouldHighlight) {
      return lines.map((line) => (line.length > 0 ? escapeHtml(line) : '&nbsp;'));
    }

    return lines.map((line) => {
      if (line.length === 0) return '&nbsp;';
      try {
        if (activeLanguage) {
          return hljs.highlight(line, { language: activeLanguage, ignoreIllegals: true }).value;
        }
        return hljs.highlightAuto(line).value;
      } catch {
        return escapeHtml(line);
      }
    });
  }, [activeLanguage, lines, normalizedContent.length]);

  const cancelEdit = useCallback(() => {
    if (savingLine !== null) return;
    setEditingLine(null);
    setDraftLine('');
  }, [savingLine]);

  const commitEdit = useCallback(async () => {
    if (editingLine === null) return;
    if (!onLineEdit) {
      setEditingLine(null);
      setDraftLine('');
      return;
    }

    const lineIndex = editingLine - 1;
    const previousLine = lines[lineIndex] ?? '';
    const nextLine = draftLine;

    if (nextLine === previousLine) {
      setEditingLine(null);
      setDraftLine('');
      return;
    }

    const nextLines = [...lines];
    nextLines[lineIndex] = nextLine;
    const nextContent = nextLines.join('\n');

    setSavingLine(editingLine);
    try {
      await onLineEdit({
        lineNumber: editingLine,
        previousLine,
        nextLine,
        nextContent,
      });
      setEditingLine(null);
      setDraftLine('');
    } finally {
      setSavingLine(null);
    }
  }, [draftLine, editingLine, lines, onLineEdit]);

  useEffect(() => {
    if (!focusLine || !containerRef.current) return;
    const lineEl = containerRef.current.querySelector<HTMLElement>(`[data-line="${focusLine}"]`);
    if (lineEl) {
      lineEl.scrollIntoView({ block: 'center' });
    }
  }, [content, focusLine]);

  useEffect(() => {
    if (editingLine && editingLine > lines.length) {
      setEditingLine(null);
      setDraftLine('');
    }
  }, [editingLine, lines.length]);

  return (
    <div
      ref={containerRef}
      className="overflow-auto rounded-xl border border-border-subtle bg-surface-0/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]"
    >
      <div className="min-w-full font-mono text-[12px] leading-5">
        {lines.map((line, index) => {
          const lineNumber = index + 1;
          const isFocused = focusLine === lineNumber;
          const isAdded = added.has(lineNumber);
          const isRemoved = removed.has(lineNumber);

          const rowClass = isFocused
            ? 'bg-accent/12 text-text-primary'
            : isAdded
              ? 'bg-success/12 text-text-primary'
              : isRemoved
                ? 'bg-danger/12 text-text-primary'
              : 'text-text-secondary';
          const lineNumberClass = isFocused
            ? 'text-accent'
            : isAdded
              ? 'text-success'
              : isRemoved
                ? 'text-danger'
              : 'text-text-muted/80';

          return (
            <div
              key={`${lineNumber}-${line}`}
              data-line={lineNumber}
              className={`group grid grid-cols-[58px_minmax(0,1fr)] border-b border-border-subtle/40 ${rowClass}`}
            >
              <span
                className={`select-none border-r border-border-subtle/60 px-2 py-0.5 text-right tabular-nums ${lineNumberClass}`}
              >
                {lineNumber}
              </span>
              <div className="relative min-w-0 px-3 py-0.5">
                {editingLine === lineNumber ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={draftLine}
                      onChange={(event) => setDraftLine(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          commitEdit().catch(() => undefined);
                        } else if (event.key === 'Escape') {
                          event.preventDefault();
                          cancelEdit();
                        }
                      }}
                      className="min-w-0 flex-1 rounded-md border border-border-strong bg-surface-0 px-2 py-0.5 text-[12px] text-text-primary outline-none"
                    />
                    <button
                      onClick={() => commitEdit().catch(() => undefined)}
                      disabled={savingLine === lineNumber}
                      className="inline-flex h-5 w-5 items-center justify-center rounded border border-border-default text-text-secondary hover:text-success hover:border-success/50 disabled:opacity-50"
                      title="Save line edit"
                    >
                      {savingLine === lineNumber ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={savingLine === lineNumber}
                      className="inline-flex h-5 w-5 items-center justify-center rounded border border-border-default text-text-secondary hover:text-danger hover:border-danger/50 disabled:opacity-50"
                      title="Cancel line edit"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span
                      className="code-panel-code whitespace-pre pr-14"
                      dangerouslySetInnerHTML={{ __html: highlightedLines[index] ?? '&nbsp;' }}
                    />
                    {(onLineComment || (editable && onLineEdit)) && (
                      <div className="absolute right-1.5 top-0.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        {onLineComment && (
                          <button
                            onClick={() => onLineComment(lineNumber, line)}
                            className="inline-flex h-5 w-5 items-center justify-center rounded border border-border-default bg-surface-1 text-text-secondary hover:border-border-strong hover:text-text-primary"
                            title="Comment on this line"
                          >
                            <MessageSquarePlus size={10} />
                          </button>
                        )}
                        {editable && onLineEdit && (
                          <button
                            onClick={() => {
                              if (savingLine !== null) return;
                              setEditingLine(lineNumber);
                              setDraftLine(line);
                            }}
                            className="inline-flex h-5 w-5 items-center justify-center rounded border border-border-default bg-surface-1 text-text-secondary hover:border-border-strong hover:text-text-primary"
                            title="Edit this line"
                          >
                            <PencilLine size={10} />
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
