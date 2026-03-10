import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Bot, ChevronDown, Send, Square } from 'lucide-react';
import { ModeSelector } from '../common/ModeSelector';
import { GitBranchSwitcher } from './GitBranchSwitcher';

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
  const [selectedModel, setSelectedModel] = useState(claudeModels[0]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

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

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
    }
  }, [value]);

  useEffect(() => {
    if (!modelMenuOpen) return;
    const handler = (event: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(event.target as Node)) {
        setModelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [modelMenuOpen]);

  return (
    <div className="relative z-20 bg-transparent px-6 pb-6 pt-4 sm:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="overflow-hidden rounded-[30px] border border-border-default/80 bg-surface-1/85 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.34)] backdrop-blur-sm transition-colors focus-within:border-border-strong">
          <div className="flex items-end gap-2.5 rounded-2xl border border-border-subtle/70 bg-surface-0/50 px-3.5 py-2.5">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Claude..."
              rows={1}
              disabled={disabled}
              className="min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] leading-6 text-text-primary placeholder-text-muted focus:outline-none disabled:opacity-50"
            />

            {isStreaming ? (
              <button
                onClick={onInterrupt}
                className="mb-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-danger text-white hover:bg-danger/90 transition-colors"
              >
                <Square size={15} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!value.trim() || disabled}
                className="mb-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-hover disabled:opacity-30 disabled:hover:bg-accent transition-colors"
              >
                <Send size={15} />
              </button>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-border-subtle/70 px-1.5 pt-2.5">
            <div className="flex items-center gap-2">
              <div className="relative" ref={modelRef}>
                <button
                  onClick={() => setModelMenuOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary hover:border-border-strong hover:text-text-primary transition-colors"
                >
                  <Bot size={13} />
                  <span>{selectedModel.label}</span>
                  <ChevronDown size={13} />
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
                        className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
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

              <div className="hidden sm:block">
                <ModeSelector />
              </div>
            </div>

            <div className="flex items-center">
              <GitBranchSwitcher />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
