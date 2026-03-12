import React, { useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import type { ProviderEventContent, ProviderMessage } from '../../../shared/provider-types';
import { MessageBubble } from './MessageBubble';
import { StreamingIndicator } from './StreamingIndicator';

interface MessageListProps {
  messages: ProviderMessage[];
  isStreaming: boolean;
  activityLines: string[];
  repoName?: string;
  onRunCommand?: (command: string) => void;
}

interface TimelineMessageItem {
  kind: 'message';
  id: string;
  message: ProviderMessage;
}

interface TimelineEventItem {
  kind: 'event';
  id: string;
  text: string;
}

type TimelineItem = TimelineMessageItem | TimelineEventItem;

function extractUserCancelledEventText(message: ProviderMessage): string | null {
  if (message.role !== 'system') return null;
  const eventBlock = message.content.find(
    (block): block is ProviderEventContent => block.type === 'event' && block.event === 'user_cancelled'
  );
  if (!eventBlock) return null;
  return eventBlock.text;
}

export function MessageList({ messages, isStreaming, activityLines, repoName, onRunCommand }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const timelineItems = messages.reduce<TimelineItem[]>((items, message) => {
    const cancelledText = extractUserCancelledEventText(message);
    if (cancelledText) {
      items.push({ kind: 'event', id: message.id, text: cancelledText });
      return items;
    }

    if (message.role === 'system' || message.role === 'tool') {
      return items;
    }

    items.push({ kind: 'message', id: message.id, message });
    return items;
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timelineItems.length, isStreaming]);

  if (timelineItems.length === 0 && !isStreaming) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-text-muted">
        <div className="text-center">
          <MessageSquare size={30} className="mx-auto mb-3 opacity-35" />
          <p className="text-[30px] font-semibold leading-none text-text-primary">Let&apos;s build</p>
          <p className="mt-1.5 text-xl text-text-secondary">{repoName || 'your-repo'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-7 pt-6 sm:px-7">
      <div className="mx-auto max-w-5xl space-y-4">
        {timelineItems.map((item) => {
          if (item.kind === 'event') {
            return (
              <div key={item.id} className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-border-subtle/70" />
                <span className="inline-flex items-center rounded-full border border-border-default bg-surface-1 px-3 py-1 text-[11px] font-medium text-text-secondary">
                  {item.text}
                </span>
                <div className="h-px flex-1 bg-border-subtle/70" />
              </div>
            );
          }

          return <MessageBubble key={item.id} message={item.message} onRunCommand={onRunCommand} />;
        })}
        {isStreaming && <StreamingIndicator activityLines={activityLines} />}
        <div ref={endRef} />
      </div>
    </div>
  );
}
