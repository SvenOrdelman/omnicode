import React, { useCallback, useState } from 'react';
import { FileCode2, Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  language?: string;
  code: string;
}

export function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="group relative my-2 rounded-lg border border-border-default bg-surface-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border-default px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <FileCode2 size={13} className="text-text-muted" />
          <span className="text-xs text-text-muted">{language || 'text'}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          {copied ? (
            <>
              <Check size={13} className="text-success" />
              <span className="text-success">Copied</span>
            </>
          ) : (
            <>
              <Copy size={13} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-sm">
        <code className={language ? `language-${language}` : ''}>{code}</code>
      </pre>
    </div>
  );
}
