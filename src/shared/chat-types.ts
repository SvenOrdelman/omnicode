export type AgentMode = 'plan' | 'chat' | 'code';
export type ChatExecutionMode = 'default' | 'acceptEdits' | 'dontAsk' | 'bypassPermissions';

export interface ChatRequestOptions {
  model?: string;
  mode?: AgentMode;
  executionMode?: ChatExecutionMode;
}

export interface ChatModelOption {
  id: string;
  label: string;
}

export interface ChatExecutionModeOption {
  id: ChatExecutionMode;
  label: string;
  description: string;
}

export const CHAT_MODELS: ChatModelOption[] = [
  { id: 'sonnet', label: 'Claude Sonnet 4.6' },
  { id: 'default', label: 'Claude Opus 4.6 (Default)' },
  { id: 'haiku', label: 'Claude Haiku 4.5' },
];

export const CHAT_EXECUTION_MODES: ChatExecutionModeOption[] = [
  {
    id: 'default',
    label: 'Safe',
    description: 'Ask for approval before risky tool actions.',
  },
  {
    id: 'acceptEdits',
    label: 'Auto edits',
    description: 'Auto-approve normal repo tools and edits; still ask for risky commands.',
  },
  {
    id: 'dontAsk',
    label: 'No prompts',
    description: "Don't ask for permissions; deny restricted tools.",
  },
  {
    id: 'bypassPermissions',
    label: 'Dangerous',
    description: 'Bypass all permission checks and run with full trust.',
  },
];

export const DEFAULT_CHAT_MODEL = CHAT_MODELS[0].id;
export const DEFAULT_CHAT_EXECUTION_MODE = CHAT_EXECUTION_MODES[0].id;

export function normalizeAgentMode(mode: string | undefined): AgentMode {
  if (mode === 'plan' || mode === 'chat' || mode === 'code') {
    return mode;
  }
  if (mode === 'ask') {
    return 'chat';
  }
  return 'code';
}

export function normalizeChatExecutionMode(mode: string | undefined): ChatExecutionMode {
  if (mode === 'default' || mode === 'acceptEdits' || mode === 'dontAsk' || mode === 'bypassPermissions') {
    return mode;
  }
  return DEFAULT_CHAT_EXECUTION_MODE;
}

export function normalizeChatModelId(model: string | undefined): string {
  if (!model) {
    return DEFAULT_CHAT_MODEL;
  }

  if (model === 'claude-sonnet-4-6') {
    return 'sonnet';
  }

  if (model === 'claude-opus-4-6' || model === 'opus') {
    return 'default';
  }

  if (model === 'claude-haiku-3-5' || model === 'claude-haiku-4-5') {
    return 'haiku';
  }

  if (CHAT_MODELS.some((candidate) => candidate.id === model)) {
    return model;
  }

  return DEFAULT_CHAT_MODEL;
}
