import { useCallback, useEffect } from 'react';
import { ipc } from '../lib/ipc-client';
import { useChatStore } from '../stores/chat.store';
import { useProjectStore } from '../stores/project.store';
import type {
  ProviderContent,
  ProviderMessage,
  ProviderStatus,
  ProviderStreamMessageEvent,
} from '../../shared/provider-types';

let streamSubscriberCount = 0;
let unsubscribeStreamHandlers: (() => void) | null = null;
const DEFAULT_SESSION_TITLE = 'New Chat';
const MAX_TITLE_LENGTH = 72;
const MAX_ACTIVITY_LINE_LENGTH = 140;

interface StoredSessionMessage {
  id: string;
  role: ProviderMessage['role'];
  content: string;
  timestamp: number;
}

function deriveTitleFromContent(content: ProviderContent[]): string {
  const text = content
    .map((block) => {
      if (block.type === 'text') return block.text;
      if (block.type === 'code') return `${block.language} code`;
      return '';
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return DEFAULT_SESSION_TITLE;
  if (text.length <= MAX_TITLE_LENGTH) return text;
  return `${text.slice(0, MAX_TITLE_LENGTH).trimEnd()}...`;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function summarizeToolUseStatus(toolName: string, input: Record<string, unknown>): string {
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

  return `${toolName} running`;
}

function summarizeStatusLine(message: ProviderMessage): string | null {
  for (const block of message.content) {
    if (block.type === 'tool_use') {
      return summarizeToolUseStatus(block.toolName, block.input);
    }
  }

  for (const block of message.content) {
    if (block.type === 'text') {
      const text = block.text.replace(/\s+/g, ' ').trim();
      if (text && text.toLowerCase() !== 'thinking...') return text;
    }

    if (block.type === 'tool_result') {
      if (block.isError) return 'Tool error';
      const normalized = block.output.replace(/\r?\n$/, '').trim();
      if (!normalized) return 'No output';
      const lines = normalized.split(/\r?\n/).length;
      return lines === 1 ? '1 line of output' : `${lines} lines of output`;
    }
  }

  return null;
}

function clampActivityLine(line: string): string {
  const normalized = line.replace(/\s+/g, ' ').trim();
  if (normalized.length <= MAX_ACTIVITY_LINE_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_ACTIVITY_LINE_LENGTH).trimEnd()}...`;
}

function hasUserFacingAssistantContent(message: ProviderMessage): boolean {
  if (message.role !== 'assistant') return false;
  return message.content.some((block) => block.type === 'text' || block.type === 'code');
}

export function useChat() {
  const {
    activeSession,
    messages,
    sessionStatusById,
    sessionErrorById,
    sessionCompletedById,
    sessionActivityById,
    setActiveSession,
    setSessionStatus,
    setSessionError,
    setSessionCompleted,
    clearSessionActivity,
    clearSessionState,
    clearChat,
    setMessages,
    addMessage,
  } = useChatStore();
  const currentProject = useProjectStore((s) => s.currentProject);
  const activeSessionId = activeSession?.id;
  const status: ProviderStatus = activeSessionId ? (sessionStatusById[activeSessionId] ?? 'idle') : 'idle';
  const error = activeSessionId ? (sessionErrorById[activeSessionId] ?? null) : null;
  const activityLines = activeSessionId ? (sessionActivityById[activeSessionId] ?? []) : [];

  const parseStoredMessage = useCallback(
    (m: StoredSessionMessage): ProviderMessage => ({
      id: m.id,
      role: m.role,
      content: JSON.parse(m.content),
      timestamp: m.timestamp,
    }),
    []
  );

  const ensureTargetSession = useCallback(async () => {
    if (!currentProject) return null;
    if (activeSession && activeSession.projectId === currentProject.id) return activeSession;

    const session = await ipc().createSession(currentProject.id);
    if (!session) return null;
    setActiveSession(session);
    clearChat();
    return session;
  }, [activeSession, clearChat, currentProject, setActiveSession]);

  useEffect(() => {
    streamSubscriberCount += 1;

    if (!unsubscribeStreamHandlers) {
      const unsubMessage = ipc().onStreamMessage((event: ProviderStreamMessageEvent) => {
        const { sessionId, message } = event;
        const state = useChatStore.getState();
        state.setSessionStatus(sessionId, 'streaming');
        state.setSessionError(sessionId, null);
        state.setSessionCompleted(sessionId, false);

        if (!message) {
          return;
        }

        if (message.role === 'tool' || (message.role === 'assistant' && !hasUserFacingAssistantContent(message))) {
          const statusLine = summarizeStatusLine(message);
          if (statusLine) {
            state.pushSessionActivity(sessionId, clampActivityLine(statusLine));
          }
          return;
        }

        if (message.role === 'user') {
          const current = state.activeSession;
          const hasUserMessage = state.messages.some((m) => m.role === 'user');
          if (current && current.id === sessionId && current.title === DEFAULT_SESSION_TITLE && !hasUserMessage) {
            state.setActiveSession({
              ...current,
              title: deriveTitleFromContent(message.content),
            });
          }
        }

        if (hasUserFacingAssistantContent(message)) {
          state.clearSessionActivity(sessionId);
        }

        if (state.activeSession?.id === sessionId) {
          state.addMessage(message);
        }
      });

      const unsubEnd = ipc().onStreamEnd((data) => {
        const state = useChatStore.getState();
        state.setSessionStatus(data.sessionId, 'idle');
        state.setSessionError(data.sessionId, null);
        state.setSessionCompleted(data.sessionId, true);
        state.clearSessionActivity(data.sessionId);
      });

      const unsubError = ipc().onStreamError((data) => {
        const state = useChatStore.getState();
        state.setSessionStatus(data.sessionId, 'error');
        state.setSessionError(data.sessionId, data.error);
        state.setSessionCompleted(data.sessionId, false);
        state.clearSessionActivity(data.sessionId);
      });

      unsubscribeStreamHandlers = () => {
        unsubMessage();
        unsubEnd();
        unsubError();
      };
    }

    return () => {
      streamSubscriberCount -= 1;
      if (streamSubscriberCount <= 0) {
        unsubscribeStreamHandlers?.();
        unsubscribeStreamHandlers = null;
        streamSubscriberCount = 0;
      }
    };
  }, []);

  const sendPrompt = useCallback(
    async (prompt: string) => {
      if (!currentProject) return;

      let targetSessionId: string | null = activeSession?.id ?? null;

      try {
        const targetSession = await ensureTargetSession();
        if (!targetSession) throw new Error('Could not create a chat session');
        targetSessionId = targetSession.id;
        setSessionStatus(targetSession.id, 'streaming');
        setSessionError(targetSession.id, null);
        setSessionCompleted(targetSession.id, false);
        clearSessionActivity(targetSession.id);

        await ipc().sendPrompt({
          sessionId: targetSession.id,
          prompt,
          cwd: currentProject.path,
          sdkSessionId: targetSession.sdkSessionId,
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to send prompt';
        if (targetSessionId) {
          setSessionStatus(targetSessionId, 'error');
          setSessionError(targetSessionId, errorMessage);
          setSessionCompleted(targetSessionId, false);
        }
      }
    },
    [
      activeSession?.id,
      clearSessionActivity,
      currentProject,
      ensureTargetSession,
      setSessionCompleted,
      setSessionError,
      setSessionStatus,
    ]
  );

  const interrupt = useCallback(async () => {
    if (!activeSession) return;
    await ipc().interrupt({ sessionId: activeSession.id });
    setSessionStatus(activeSession.id, 'idle');
    setSessionCompleted(activeSession.id, false);
    clearSessionActivity(activeSession.id);
  }, [activeSession, clearSessionActivity, setSessionCompleted, setSessionStatus]);

  const loadSession = useCallback(
    async (sessionId: string) => {
      const result = await ipc().getSession(sessionId);
      if (!result) return;

      setActiveSession(result.session);

      const parsed: ProviderMessage[] = result.messages.map(parseStoredMessage);
      setMessages(parsed);
    },
    [parseStoredMessage, setActiveSession, setMessages]
  );

  const newChat = useCallback(async () => {
    if (!currentProject) return;
    const session = await ipc().createSession(currentProject.id);
    setActiveSession(session);
    clearChat();
    setSessionStatus(session.id, 'idle');
    setSessionError(session.id, null);
    setSessionCompleted(session.id, false);
    clearSessionActivity(session.id);
  }, [
    clearChat,
    clearSessionActivity,
    currentProject,
    setActiveSession,
    setSessionCompleted,
    setSessionError,
    setSessionStatus,
  ]);

  const appendLocalMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      const targetSession = await ensureTargetSession();
      if (!targetSession) return;

      const content: ProviderContent[] = [{ type: 'text', text }];
      const result = await ipc().addSessionMessage({
        sessionId: targetSession.id,
        role: 'user',
        content,
      });

      if (result?.session) {
        setActiveSession(result.session);
      }

      if (result?.message) {
        addMessage(parseStoredMessage(result.message));
      }
    },
    [addMessage, ensureTargetSession, parseStoredMessage, setActiveSession]
  );

  const archiveSession = useCallback(
    async (sessionId: string) => {
      await ipc().archiveSession({ sessionId, archived: true });
      clearSessionState(sessionId);
      if (activeSession?.id === sessionId) {
        setActiveSession(null);
        clearChat();
      }
    },
    [activeSession?.id, clearChat, clearSessionState, setActiveSession]
  );

  return {
    activeSession,
    messages,
    status,
    error,
    activityLines,
    sessionStatusById,
    sessionCompletedById,
    sendPrompt,
    interrupt,
    loadSession,
    newChat,
    appendLocalMessage,
    archiveSession,
  };
}
