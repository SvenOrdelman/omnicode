import React, { useCallback, useMemo, useState } from 'react';
import hljs from 'highlight.js/lib/common';
import { FileCode2, Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  language?: string;
  code: string;
}

const LANGUAGE_ALIASES: Record<string, string> = {
  rb: 'ruby',
  shell: 'bash',
  sh: 'bash',
  zsh: 'bash',
  yml: 'yaml',
};

function resolveLanguage(language?: string): string | null {
  if (!language) return null;
  const normalized = language.trim().toLowerCase();
  if (!normalized) return null;

  const mapped = LANGUAGE_ALIASES[normalized] ?? normalized;
  return hljs.getLanguage(mapped) ? mapped : null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const activeLanguage = useMemo(() => resolveLanguage(language), [language]);
  const highlightedCode = useMemo(() => {
    try {
      if (activeLanguage) {
        return hljs.highlight(code, { language: activeLanguage, ignoreIllegals: true }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return escapeHtml(code);
    }
  }, [activeLanguage, code]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="group relative my-2 rounded-lg border border-border-default bg-surface-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border-default px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <FileCode2 size={12} className="text-text-muted" />
          <span className="text-[11px] text-text-muted">{language || 'text'}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-secondary transition-colors"
        >
          {copied ? (
            <>
              <Check size={12} className="text-success" />
              <span className="text-success">Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[12px] leading-5">
        <code
          className={`code-block-code ${activeLanguage ? `language-${activeLanguage}` : ''}`.trim()}
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
      </pre>
    </div>
  );
}
