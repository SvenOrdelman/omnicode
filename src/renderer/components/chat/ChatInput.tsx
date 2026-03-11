import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Bot, ChevronDown, MessageSquareText, Send, Square } from 'lucide-react';
import { ModeSelector } from '../common/ModeSelector';
import { useFrequentPromptsStore } from '../../stores/frequent-prompts.store';

interface ChatInputProps {
  onSend: (prompt: string) => void;
  onInterrupt: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

const claudeModels = [
  { id: 'claude-sonnet', label: 'Claude Sonnet 4' },
  { id: 'claude-opus', label: 'Claude Opus 4' },
  { id: 'claude-haiku', label: 'Claude Haiku 3.5' },
];

export function ChatInput({ onSend, onInterrupt, isStreaming, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [promptMenuOpen, setPromptMenuOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(claudeModels[0]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const frequentPrompts = useFrequentPromptsStore((s) => s.prompts);
  const sortedPrompts = useMemo(
    () => [...frequentPrompts].sort((a, b) => b.updatedAt - a.updatedAt),
    [frequentPrompts]
  );

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleSendFrequentPrompt = useCallback(
    (message: string) => {
      const trimmed = message.trim();
      if (!trimmed || disabled || isStreaming) return;
      onSend(trimmed);
      setPromptMenuOpen(false);
    },
    [disabled, isStreaming, onSend]
  );

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
    }
  }, [value]);

  useEffect(() => {
    if (!modelMenuOpen && !promptMenuOpen) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;

      if (modelRef.current && !modelRef.current.contains(target)) {
        setModelMenuOpen(false);
      }

      if (promptRef.current && !promptRef.current.contains(target)) {
        setPromptMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [modelMenuOpen, promptMenuOpen]);

  return (
    <div className="relative z-20 bg-transparent px-5 pb-5 pt-3 sm:px-7">
      <div className="mx-auto w-full max-w-5xl">
        <div className="overflow-visible rounded-2xl border border-border-default/80 bg-surface-1/85 p-3.5 shadow-[0_14px_36px_rgba(0,0,0,0.32)] backdrop-blur-sm transition-colors focus-within:border-border-strong">
          <div className="flex items-end gap-2 rounded-xl border border-border-subtle/70 bg-surface-0/50 px-3 py-2">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Claude..."
              rows={1}
              disabled={disabled}
              className="min-h-[38px] flex-1 resize-none bg-transparent px-2.5 py-2 text-[13px] leading-5 text-text-primary placeholder-text-muted focus:outline-none disabled:opacity-50"
            />

            {isStreaming ? (
              <button
                onClick={onInterrupt}
                className="mb-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-danger text-white hover:bg-danger/90 transition-colors"
              >
                <Square size={14} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!value.trim() || disabled}
                className="mb-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-hover disabled:opacity-30 disabled:hover:bg-accent transition-colors"
              >
                <Send size={14} />
              </button>
            )}
          </div>

          <div className="mt-2.5 flex items-center gap-3 border-t border-border-subtle/70 px-1.5 pt-2">
            <div className="flex items-center gap-2">
              <div className="relative" ref={modelRef}>
                <button
                  onClick={() => {
                    setPromptMenuOpen(false);
                    setModelMenuOpen((v) => !v);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border-default px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:border-border-strong hover:text-text-primary transition-colors"
                >
                  <Bot size={12} />
                  <span>{selectedModel.label}</span>
                  <ChevronDown size={12} />
                </button>

                {modelMenuOpen && (
                  <div className="absolute bottom-full left-0 z-50 mb-2 w-52 rounded-xl border border-border-default bg-surface-2 p-1 shadow-xl">
                    {claudeModels.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedModel(model);
                          setModelMenuOpen(false);
                        }}
                        className={`w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] transition-colors ${
                          selectedModel.id === model.id
                            ? 'bg-accent-muted text-text-primary'
                            : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
                        }`}
                      >
                        {model.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative" ref={promptRef}>
                <button
                  onClick={() => {
                    if (!sortedPrompts.length) return;
                    setModelMenuOpen(false);
                    setPromptMenuOpen((v) => !v);
                  }}
                  disabled={!sortedPrompts.length || disabled || isStreaming}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border-default px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:border-border-strong hover:text-text-primary disabled:opacity-50 disabled:hover:border-border-default disabled:hover:text-text-secondary transition-colors"
                >
                  <MessageSquareText size={12} />
                  <span>{sortedPrompts.length ? 'Frequent prompts' : 'No frequent prompts'}</span>
                  <ChevronDown size={12} />
                </button>

                {promptMenuOpen && (
                  <div className="absolute bottom-full left-0 z-50 mb-2 w-80 rounded-xl border border-border-default bg-surface-2 p-1 shadow-xl">
                    {sortedPrompts.map((prompt) => (
                      <button
                        key={prompt.id}
                        onClick={() => handleSendFrequentPrompt(prompt.message)}
                        className="w-full rounded-lg px-2.5 py-2 text-left transition-colors text-text-secondary hover:bg-surface-3 hover:text-text-primary"
                      >
                        <div className="truncate text-[11px] font-semibold">{prompt.title}</div>
                        <div className="mt-0.5 truncate text-[11px]">{prompt.message}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="hidden sm:block">
                <ModeSelector />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
