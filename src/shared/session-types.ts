import type { AgentMode, ChatExecutionMode } from './chat-types';

export interface Session {
  id: string;
  projectId: string;
  title: string;
  provider: string;
  sdkSessionId?: string;
  model: string;
  agentMode: AgentMode;
  executionMode: ChatExecutionMode;
  archived: boolean;
  archivedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface SessionMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string; // JSON-serialized ProviderContent[]
  timestamp: number;
}
