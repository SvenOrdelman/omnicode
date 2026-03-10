import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Wrench, AlertCircle, Brain } from 'lucide-react';
import type { ProviderMessage, ProviderContent } from '../../../shared/provider-types';
import { CodeBlock } from './CodeBlock';
import { Avatar } from '../common/Avatar';

interface MessageBubbleProps {
  message: ProviderMessage;
}

function renderContent(content: ProviderContent) {
  switch (content.type) {
    case 'text':
      return (
        <div className="prose prose-invert prose-sm max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_pre]:overflow-x-auto">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const codeStr = String(children).replace(/\n$/, '');
                if (match) {
                  return <CodeBlock language={match[1]} code={codeStr} />;
                }
                return (
                  <code className="rounded bg-surface-3 px-1.5 py-0.5 text-sm" {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {content.text}
          </ReactMarkdown>
        </div>
      );

    case 'code':
      return <CodeBlock language={content.language} code={content.code} />;

    case 'tool_use':
      return (
        <div className="my-2 rounded-lg border border-border-default bg-surface-0 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border-default px-3 py-1.5 bg-surface-2">
            <Wrench size={13} className="text-accent" />
            <span className="text-xs font-medium text-accent">{content.toolName}</span>
          </div>
          <pre className="max-w-full overflow-x-auto p-3 text-xs text-text-secondary">
            {JSON.stringify(content.input, null, 2)}
          </pre>
        </div>
      );

    case 'tool_result':
      return (
        <div
          className={`my-2 rounded-lg border overflow-hidden ${
            content.isError
              ? 'border-danger/30 bg-danger/5'
              : 'border-border-default bg-surface-0'
          }`}
        >
          {content.isError && (
            <div className="flex items-center gap-1.5 border-b border-danger/20 bg-danger/10 px-3 py-1.5">
              <AlertCircle size={13} className="text-danger" />
              <span className="text-xs font-medium text-danger">Error</span>
            </div>
          )}
          <pre className="max-w-full overflow-x-auto p-3 text-xs text-text-secondary">{content.output}</pre>
        </div>
      );

    case 'thinking':
      return (
        <details className="my-2 rounded-lg border border-border-default bg-surface-0 overflow-hidden">
          <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs text-text-muted hover:text-text-secondary transition-colors">
            <Brain size={13} />
            Thinking...
          </summary>
          <pre className="border-t border-border-subtle px-3 py-2 text-xs text-text-muted whitespace-pre-wrap">
            {content.thinking}
          </pre>
        </details>
      );

    default:
      return null;
  }
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && <Avatar role="assistant" />}

      <div
        className={`min-w-0 max-w-[min(860px,88%)] overflow-hidden rounded-2xl border px-5 py-4 shadow-[0_8px_26px_rgba(0,0,0,0.22)] ${
          isUser
            ? 'border-accent/35 bg-gradient-to-br from-accent/14 to-accent/8'
            : 'border-border-default/80 bg-surface-1/90 backdrop-blur-sm'
        }`}
      >
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          {isUser ? 'You' : 'Claude'}
        </div>
        <div className="space-y-3 px-0.5">
          {message.content.map((c, i) => (
            <React.Fragment key={i}>{renderContent(c)}</React.Fragment>
          ))}
        </div>
      </div>

      {isUser && <Avatar role="user" />}
    </div>
  );
}
