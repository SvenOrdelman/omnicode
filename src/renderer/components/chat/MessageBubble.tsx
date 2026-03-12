import React from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Wrench, AlertCircle, Brain } from 'lucide-react';
import type {
  ProviderMessage,
  ProviderContent,
  ProviderToolResultContent,
  ProviderToolUseContent,
} from '../../../shared/provider-types';
import { CodeBlock } from './CodeBlock';
import { Avatar } from '../common/Avatar';

interface MessageBubbleProps {
  message: ProviderMessage;
  onRunCommand?: (command: string) => void;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function summarizeToolUse(content: ProviderToolUseContent): string {
  const toolName = content.toolName;
  const input = content.input;
  const normalized = toolName.toLowerCase();

  if (normalized === 'grep') {
    const pattern = asString(input.pattern);
    const glob = asString(input.glob);
    const path = asString(input.path);
    if (pattern && glob) return `Grep "${pattern}" (glob: ${glob})`;
    if (pattern && path) return `Grep "${pattern}" in ${path}`;
    if (pattern) return `Grep "${pattern}"`;
  }

  if (normalized === 'read') {
    const path = asString(input.file_path) || asString(input.path);
    if (path) return `Read ${path}`;
  }

  if (normalized === 'glob') {
    const pattern = asString(input.pattern);
    const path = asString(input.path);
    if (pattern && path) return `Glob "${pattern}" in ${path}`;
    if (pattern) return `Glob "${pattern}"`;
  }

  if (normalized === 'bash') {
    const command = asString(input.command) || asString(input.cmd);
    if (command) return `Bash ${command}`;
  }

  if (normalized === 'edit') {
    const path = asString(input.file_path) || asString(input.path);
    if (path) return `Edit ${path}`;
  }

  if (normalized === 'write') {
    const path = asString(input.file_path) || asString(input.path);
    if (path) return `Write ${path}`;
  }

  return `${toolName} ${JSON.stringify(input)}`;
}

function summarizeToolResult(content: ProviderToolResultContent): string {
  const normalized = content.output.replace(/\r?\n$/, '');
  if (!normalized) return 'No output';
  const lines = normalized.split(/\r?\n/).length;
  if (lines === 1) return '1 line of output';
  return `${lines} lines of output`;
}

function decodeCommandHref(href: string): string | null {
  if (href.startsWith('command://')) {
    return decodeURIComponent(href.slice('command://'.length));
  }
  if (href.startsWith('command:')) {
    return decodeURIComponent(href.slice('command:'.length));
  }
  return null;
}

function allowCommandUrlTransform(url: string): string {
  if (/^command:/i.test(url)) {
    return url;
  }
  return defaultUrlTransform(url);
}

function createMarkdownComponents(onRunCommand?: (command: string) => void): Components {
  return {
    ul({ children }) {
      return <ul className="list-disc pl-5">{children}</ul>;
    },
    ol({ children }) {
      return <ol className="list-decimal pl-5">{children}</ol>;
    },
    li({ children, className }) {
      return <li className={className}>{children}</li>;
    },
    table({ children }) {
      return (
        <div className="my-2 overflow-x-auto rounded-md border border-border-default">
          <table className="min-w-full border-collapse">{children}</table>
        </div>
      );
    },
    a({ href, children }) {
      const url = href || '';
      const command = decodeCommandHref(url);
      if (command && onRunCommand) {
        return (
          <button
            type="button"
            onClick={() => onRunCommand(command)}
            className="rounded-md border border-border-default bg-surface-2 px-1.5 py-0.5 text-[11px] text-accent hover:border-border-strong hover:text-accent-hover transition-colors"
          >
            {children}
          </button>
        );
      }
      return (
        <a href={url} target="_blank" rel="noreferrer">
          {children}
        </a>
      );
    },
    code({ className, children, ...props }) {
      const match = /language-([\w-]+)/.exec(className || '');
      const codeStr = String(children).replace(/\n$/, '');
      if (match) {
        return <CodeBlock language={match[1]} code={codeStr} />;
      }
      return (
        <code className="rounded-md px-1.5 py-0.5 text-[12px]" {...props}>
          {children}
        </code>
      );
    },
  };
}

function renderContent(content: ProviderContent, onRunCommand?: (command: string) => void) {
  switch (content.type) {
    case 'text':
      return (
        <div className="markdown-body max-w-none break-words">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={createMarkdownComponents(onRunCommand)}
            urlTransform={allowCommandUrlTransform}
          >
            {content.text}
          </ReactMarkdown>
        </div>
      );

    case 'code':
      return <CodeBlock language={content.language} code={content.code} />;

    case 'tool_use':
      return (
        <div className="my-2 rounded-lg border border-border-default bg-surface-0 px-3 py-2">
          <div className="flex items-center gap-2">
            <Wrench size={13} className="text-accent" />
            <span className="font-mono text-[11px] text-text-secondary">{summarizeToolUse(content)}</span>
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer text-[11px] text-text-muted">Details</summary>
            <pre className="mt-2 max-w-full overflow-x-auto rounded-md bg-surface-2 p-2 text-xs text-text-secondary">
              {JSON.stringify(content.input, null, 2)}
            </pre>
          </details>
        </div>
      );

    case 'tool_result':
      return (
        <details
          open={Boolean(content.isError)}
          className={`my-2 rounded-lg border overflow-hidden ${
            content.isError
              ? 'border-danger/30 bg-danger/5'
              : 'border-border-default bg-surface-0'
          }`}
        >
          <summary
            className={`flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-[11px] ${
              content.isError ? 'bg-danger/10 text-danger' : 'bg-surface-2 text-text-muted'
            }`}
          >
            {content.isError && <AlertCircle size={13} className="text-danger" />}
            <span className="font-medium">{content.isError ? `Tool error: ${summarizeToolResult(content)}` : summarizeToolResult(content)}</span>
          </summary>
          <pre className="max-w-full overflow-x-auto border-t border-border-subtle p-3 text-[11px] leading-5 text-text-secondary">
            {content.output || '(no output)'}
          </pre>
        </details>
      );

    case 'thinking':
      return (
        <div className="my-2 rounded-lg border border-border-default bg-surface-0 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2 text-[11px] text-text-muted">
            <Brain size={13} />
            Thinking
          </div>
          <pre className="whitespace-pre-wrap px-3 py-2 text-[11px] text-text-muted">
            {content.thinking}
          </pre>
        </div>
      );

    default:
      return null;
  }
}

export function MessageBubble({ message, onRunCommand }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const label = isUser ? 'You' : message.role === 'tool' ? 'Claude logs' : 'Claude';

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && <Avatar role="assistant" />}

      <div
        className={`min-w-0 max-w-[min(840px,86%)] overflow-hidden rounded-xl border px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.2)] ${
          isUser
            ? 'border-accent/35 bg-gradient-to-br from-accent/16 to-accent-warm/10'
            : 'border-border-default/80 bg-surface-1/90 backdrop-blur-sm'
        }`}
      >
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          {label}
        </div>
        <div className="space-y-2.5 px-0.5 text-[13px]">
          {message.content.map((c, i) => (
            <React.Fragment key={i}>{renderContent(c, onRunCommand)}</React.Fragment>
          ))}
        </div>
      </div>

      {isUser && <Avatar role="user" />}
    </div>
  );
}
