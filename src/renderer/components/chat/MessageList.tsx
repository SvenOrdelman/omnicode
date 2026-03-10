import React, { useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import type { ProviderMessage } from '../../../shared/provider-types';
import { MessageBubble } from './MessageBubble';
import { StreamingIndicator } from './StreamingIndicator';

interface MessageListProps {
  messages: ProviderMessage[];
  isStreaming: boolean;
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const visibleMessages = messages.filter((message) => message.role !== 'system');

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isStreaming]);

  if (visibleMessages.length === 0 && !isStreaming) {
    return (
      <div className="flex h-full items-center justify-center text-text-muted">
        <div className="text-center">
          <MessageSquare size={38} className="mx-auto mb-4 opacity-35" />
          <p className="text-[42px] font-semibold leading-none text-text-primary">Let&apos;s build</p>
          <p className="mt-2 text-3xl text-text-secondary">omnicode</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-7">
      <div className="mx-auto max-w-5xl space-y-3">
        {visibleMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isStreaming && <StreamingIndicator />}
        <div ref={endRef} />
      </div>
    </div>
  );
}
