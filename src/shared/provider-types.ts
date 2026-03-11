// Normalized message types shared between main and renderer.
// The renderer never depends on provider-specific types.

export type ProviderMessageRole = 'assistant' | 'user' | 'system' | 'tool';

export interface ProviderTextContent {
  type: 'text';
  text: string;
}

export interface ProviderCodeContent {
  type: 'code';
  language: string;
  code: string;
}

export interface ProviderToolUseContent {
  type: 'tool_use';
  toolName: string;
  toolId: string;
  input: Record<string, unknown>;
}

export interface ProviderToolResultContent {
  type: 'tool_result';
  toolId: string;
  output: string;
  isError?: boolean;
}

export interface ProviderThinkingContent {
  type: 'thinking';
  thinking: string;
}

export interface ProviderEventContent {
  type: 'event';
  event: 'user_cancelled';
  text: string;
}

export type ProviderContent =
  | ProviderTextContent
  | ProviderCodeContent
  | ProviderToolUseContent
  | ProviderToolResultContent
  | ProviderThinkingContent
  | ProviderEventContent;

export interface ProviderMessage {
  id: string;
  role: ProviderMessageRole;
  content: ProviderContent[];
  timestamp: number;
  isStreaming?: boolean;
}

export interface ProviderStreamDelta {
  messageId: string;
  content: ProviderContent;
  done?: boolean;
}

export interface ProviderStreamMessageEvent {
  sessionId: string;
  message?: ProviderMessage;
  delta?: ProviderStreamDelta;
}

export interface ProviderStreamEndEvent {
  sessionId: string;
}

export interface ProviderStreamErrorEvent {
  sessionId: string;
  error: string;
}

export interface ApprovalRequest {
  id: string;
  sessionId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  description: string;
  timestamp: number;
}

export interface ApprovalResponse {
  id: string;
  approved: boolean;
}

export type ProviderStatus = 'idle' | 'streaming' | 'waiting_approval' | 'error';
