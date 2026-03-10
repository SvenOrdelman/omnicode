import { v4 as uuid } from 'uuid';
import type { ProviderMessage, ProviderContent, ProviderStreamDelta } from '../../../shared/provider-types';

// Adapts Claude Agent SDK messages to normalized ProviderMessage types.
// The SDK yields various message types - we normalize them for the renderer.

export function adaptSdkMessage(sdkMessage: any): ProviderMessage | null {
  if (!sdkMessage) return null;

  // ResultMessage - final result
  if ('result' in sdkMessage && typeof sdkMessage.result === 'string') {
    return {
      id: uuid(),
      role: 'assistant',
      content: [{ type: 'text', text: sdkMessage.result }],
      timestamp: Date.now(),
    };
  }

  // AssistantMessage with content blocks
  if (sdkMessage.type === 'assistant' && Array.isArray(sdkMessage.content)) {
    const content: ProviderContent[] = sdkMessage.content.map((block: any) => {
      if (block.type === 'text') {
        return { type: 'text' as const, text: block.text };
      }
      if (block.type === 'thinking') {
        return { type: 'thinking' as const, thinking: block.thinking };
      }
      if (block.type === 'tool_use') {
        return {
          type: 'tool_use' as const,
          toolName: block.name,
          toolId: block.id,
          input: block.input,
        };
      }
      return { type: 'text' as const, text: JSON.stringify(block) };
    });

    return {
      id: uuid(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
    };
  }

  // System message (init, etc.)
  if (sdkMessage.type === 'system') {
    return {
      id: uuid(),
      role: 'system',
      content: [{ type: 'text', text: sdkMessage.subtype || 'system' }],
      timestamp: Date.now(),
    };
  }

  return null;
}

export function createStreamDelta(messageId: string, text: string, done = false): ProviderStreamDelta {
  return {
    messageId,
    content: { type: 'text', text },
    done,
  };
}

export function createUserMessage(prompt: string): ProviderMessage {
  return {
    id: uuid(),
    role: 'user',
    content: [{ type: 'text', text: prompt }],
    timestamp: Date.now(),
  };
}
