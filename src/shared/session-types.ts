export interface Session {
  id: string;
  projectId: string;
  title: string;
  provider: string;
  sdkSessionId?: string;
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
