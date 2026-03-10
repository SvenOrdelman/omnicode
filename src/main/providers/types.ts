import type { ProviderMessage, ProviderStreamDelta, ApprovalRequest } from '../../shared/provider-types';

export interface ProviderConfig {
  model?: string;
  cwd?: string;
}

export interface SendPromptOptions {
  sessionId: string;
  prompt: string;
  cwd: string;
  sdkSessionId?: string;
  onMessage: (message: ProviderMessage) => void;
  onDelta: (delta: ProviderStreamDelta) => void;
  onApprovalRequest: (request: ApprovalRequest) => Promise<boolean>;
  onEnd: () => void;
  onError: (error: Error) => void;
}

export interface ILLMProvider {
  readonly id: string;
  readonly displayName: string;

  configure(config: ProviderConfig): void;
  isConfigured(): boolean;
  sendPrompt(options: SendPromptOptions): Promise<void>;
  interrupt(sessionId: string): void;
}
