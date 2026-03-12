import { v4 as uuid } from 'uuid';
import type { ProviderMessage, ProviderContent, ProviderStreamDelta } from '../../../shared/provider-types';

// Adapts Claude Agent SDK messages to normalized ProviderMessage types.
// The SDK yields various message types - we normalize them for the renderer.

function stringifyBlockContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        if (entry && typeof entry === 'object' && 'type' in entry) {
          const block = entry as { type?: string; text?: unknown };
          if (block.type === 'text' && typeof block.text === 'string') {
            return block.text;
          }
        }
        return JSON.stringify(entry);
      })
      .join('\n');
  }

  if (content == null) {
    return '';
  }

  return JSON.stringify(content);
}

function extractContentBlocks(sdkMessage: any): any[] | null {
  if (Array.isArray(sdkMessage?.content)) {
    return sdkMessage.content;
  }

  const nestedContent = sdkMessage?.message?.content;
  if (Array.isArray(nestedContent)) {
    return nestedContent;
  }

  return null;
}

function adaptContentBlock(block: any): ProviderContent {
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
      input: block.input ?? {},
    };
  }

  if (block.type === 'tool_result') {
    return {
      type: 'tool_result' as const,
      toolId: block.tool_use_id ?? block.toolId ?? block.id ?? uuid(),
      output: stringifyBlockContent(block.content),
      isError: Boolean(block.is_error || block.isError),
    };
  }

  return { type: 'text' as const, text: JSON.stringify(block) };
}

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

  // AssistantMessage with content blocks (SDKAssistantMessage.message.content)
  if (sdkMessage.type === 'assistant') {
    const blocks = extractContentBlocks(sdkMessage);
    if (!blocks) return null;
    const content: ProviderContent[] = blocks.map((block: any) => adaptContentBlock(block));
    const hasUserFacingContent = content.some((block) => block.type === 'text' || block.type === 'code');

    return {
      id: uuid(),
      role: hasUserFacingContent ? 'assistant' : 'tool',
      content,
      timestamp: Date.now(),
    };
  }

  // User messages from the SDK include tool_result blocks.
  if (sdkMessage.type === 'user') {
    const blocks = extractContentBlocks(sdkMessage);
    if (!blocks) return null;
    const content: ProviderContent[] = blocks.map((block: any) => adaptContentBlock(block));

    return {
      id: uuid(),
      role: 'tool',
      content,
      timestamp: Date.now(),
    };
  }

  if (sdkMessage.type === 'tool_use_summary' && typeof sdkMessage.summary === 'string') {
    return {
      id: uuid(),
      role: 'tool',
      content: [{ type: 'text', text: sdkMessage.summary }],
      timestamp: Date.now(),
    };
  }

  if (sdkMessage.type === 'tool_progress' && typeof sdkMessage.tool_name === 'string') {
    return {
      id: uuid(),
      role: 'tool',
      content: [{ type: 'text', text: `${sdkMessage.tool_name} in progress...` }],
      timestamp: Date.now(),
    };
  }

  // System message (init, etc.)
  if (sdkMessage.type === 'system') {
    if (sdkMessage.subtype === 'init') {
      return null;
    }

    if (sdkMessage.subtype === 'local_command_output' && typeof sdkMessage.content === 'string') {
      return {
        id: uuid(),
        role: 'assistant',
        content: [{ type: 'text', text: sdkMessage.content }],
        timestamp: Date.now(),
      };
    }

    if (
      (sdkMessage.subtype === 'task_progress' ||
        sdkMessage.subtype === 'task_started' ||
        sdkMessage.subtype === 'task_notification') &&
      (typeof sdkMessage.summary === 'string' || typeof sdkMessage.description === 'string')
    ) {
      return {
        id: uuid(),
        role: 'tool',
        content: [{ type: 'text', text: sdkMessage.summary || sdkMessage.description }],
        timestamp: Date.now(),
      };
    }

    return {
      id: uuid(),
      role: 'system',
      content: [{ type: 'text', text: sdkMessage.subtype || 'system' }],
      timestamp: Date.now(),
    };
  }

  if (sdkMessage.type === 'auth_status' && Array.isArray(sdkMessage.output)) {
    const output = sdkMessage.output.join('\n').trim();
    if (!output) return null;
    return {
      id: uuid(),
      role: 'tool',
      content: [{ type: 'text', text: output }],
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
