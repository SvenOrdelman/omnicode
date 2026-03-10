import { useCallback, useEffect } from 'react';
import { ipc } from '../lib/ipc-client';
import { useChatStore } from '../stores/chat.store';
import { useProjectStore } from '../stores/project.store';
import type { ProviderContent, ProviderMessage } from '../../shared/provider-types';

let streamSubscriberCount = 0;
let unsubscribeStreamHandlers: (() => void) | null = null;
const DEFAULT_SESSION_TITLE = 'New Chat';
const MAX_TITLE_LENGTH = 72;

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

export function useChat() {
  const {
    activeSession,
    messages,
    status,
    error,
    setActiveSession,
    setStatus,
    setError,
    clearChat,
    setMessages,
    addMessage,
  } = useChatStore();
  const currentProject = useProjectStore((s) => s.currentProject);

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
      const unsubMessage = ipc().onStreamMessage((message: ProviderMessage) => {
        const state = useChatStore.getState();

        if (message.role === 'user') {
          const current = state.activeSession;
          const hasUserMessage = state.messages.some((m) => m.role === 'user');
          if (current && current.title === DEFAULT_SESSION_TITLE && !hasUserMessage) {
            state.setActiveSession({
              ...current,
              title: deriveTitleFromContent(message.content),
            });
          }
        }

        state.addMessage(message);
        state.setStatus('streaming');
      });

      const unsubEnd = ipc().onStreamEnd(() => {
        useChatStore.getState().setStatus('idle');
      });

      const unsubError = ipc().onStreamError((data) => {
        useChatStore.getState().setStatus('error');
        useChatStore.getState().setError(data.error);
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

      setStatus('streaming');
      setError(null);

      try {
        const targetSession = await ensureTargetSession();
        if (!targetSession) throw new Error('Could not create a chat session');

        await ipc().sendPrompt({
          sessionId: targetSession.id,
          prompt,
          cwd: currentProject.path,
          sdkSessionId: targetSession.sdkSessionId,
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to send prompt';
        setStatus('error');
        setError(errorMessage);
      }
    },
    [currentProject, ensureTargetSession, setStatus, setError]
  );

  const interrupt = useCallback(async () => {
    if (!activeSession) return;
    await ipc().interrupt({ sessionId: activeSession.id });
    setStatus('idle');
  }, [activeSession, setStatus]);

  const loadSession = useCallback(
    async (sessionId: string) => {
      const result = await ipc().getSession(sessionId);
      if (!result) return;

      setActiveSession(result.session);

      const parsed: ProviderMessage[] = result.messages.map(parseStoredMessage);
      setMessages(parsed);
      setStatus('idle');
    },
    [parseStoredMessage, setActiveSession, setMessages, setStatus]
  );

  const newChat = useCallback(async () => {
    if (!currentProject) return;
    const session = await ipc().createSession(currentProject.id);
    setActiveSession(session);
    clearChat();
  }, [currentProject, setActiveSession, clearChat]);

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
      if (activeSession?.id === sessionId) {
        setActiveSession(null);
        clearChat();
      }
    },
    [activeSession?.id, clearChat, setActiveSession]
  );

  return {
    activeSession,
    messages,
    status,
    error,
    sendPrompt,
    interrupt,
    loadSession,
    newChat,
    appendLocalMessage,
    archiveSession,
  };
}
