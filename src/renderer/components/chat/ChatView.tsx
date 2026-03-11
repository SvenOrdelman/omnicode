import React from 'react';
import { useChat } from '../../hooks/useChat';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { ApprovalDialog } from '../approval/ApprovalDialog';
import { Archive } from 'lucide-react';
import { useProjectStore } from '../../stores/project.store';

export function ChatView() {
  const { messages, status, error, activityLines, sendPrompt, interrupt, activeSession, archiveSession } = useChat();
  const currentProject = useProjectStore((s) => s.currentProject);
  const isStreaming = status === 'streaming';

  return (
    <div className="relative flex h-full flex-col bg-surface-0">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-accent/10 via-accent-cool/6 to-transparent" />
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-border-subtle/80 bg-surface-0/70 px-6 py-2.5 backdrop-blur-md [-webkit-app-region:drag]">
        <h2 className="max-w-[55%] truncate text-xs font-medium text-text-secondary [-webkit-app-region:no-drag]">
          {activeSession?.title || 'New thread'}
        </h2>
        <div className="flex items-center gap-2 [-webkit-app-region:no-drag]">
          <button
            onClick={() => {
              if (!activeSession) return;
              archiveSession(activeSession.id).catch(() => undefined);
            }}
            disabled={!activeSession}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-1 px-2.5 py-1 text-[11px] text-text-secondary hover:border-border-strong hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            <Archive size={12} />
            Archive
          </button>
          <span className="max-w-[170px] truncate text-[11px] font-medium text-success">
            {currentProject ? currentProject.name : ''}
          </span>
        </div>
      </div>

      {/* Messages */}
      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        activityLines={activityLines}
        repoName={currentProject?.name}
      />

      {/* Error banner */}
      {error && (
        <div className="border-t border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Approval dialogs */}
      <ApprovalDialog />

      {/* Input */}
      <ChatInput
        onSend={sendPrompt}
        onInterrupt={interrupt}
        isStreaming={isStreaming}
        disabled={!currentProject}
      />
    </div>
  );
}
