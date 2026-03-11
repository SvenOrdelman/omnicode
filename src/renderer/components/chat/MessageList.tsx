import React, { useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import type { ProviderMessage } from '../../../shared/provider-types';
import { MessageBubble } from './MessageBubble';
import { StreamingIndicator } from './StreamingIndicator';

interface MessageListProps {
  messages: ProviderMessage[];
  isStreaming: boolean;
  activityLines: string[];
  repoName?: string;
}

export function MessageList({ messages, isStreaming, activityLines, repoName }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const visibleMessages = messages.filter((message) => message.role !== 'system' && message.role !== 'tool');

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isStreaming]);

  if (visibleMessages.length === 0 && !isStreaming) {
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
        {visibleMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isStreaming && <StreamingIndicator activityLines={activityLines} />}
        <div ref={endRef} />
      </div>
    </div>
  );
}
