import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Bot, ChevronDown, Plus, Send, Sparkles, Square } from 'lucide-react';
import { useUIStore } from '../../stores/ui.store';
import { ModeSelector } from '../common/ModeSelector';
import { GitBranchSwitcher } from './GitBranchSwitcher';

interface ChatInputProps {
  onSend: (prompt: string) => void;
  onInterrupt: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

const modeLabels = { code: 'Code', plan: 'Plan', ask: 'Ask' } as const;
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
  const agentMode = useUIStore((s) => s.agentMode);

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
    <div className="relative z-20 bg-transparent px-8 pb-8 pt-3">
      <div className="mx-auto w-full max-w-5xl">
        <div className="rounded-[34px] border border-border-default/85 bg-surface-1/80 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.38)] backdrop-blur-sm transition-colors focus-within:border-border-strong">
          <div className="flex items-end gap-3">
            <button className="mb-1 inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-border-default text-text-muted hover:border-border-strong hover:text-text-primary transition-colors">
              <Plus size={16} />
            </button>

            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message Claude (${modeLabels[agentMode]} mode)...`}
              rows={1}
              disabled={disabled}
              className="flex-1 resize-none bg-transparent px-1.5 py-2 text-base text-text-primary placeholder-text-muted focus:outline-none disabled:opacity-50"
            />

            {isStreaming ? (
              <button
                onClick={onInterrupt}
                className="mb-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-danger text-white hover:bg-danger/90 transition-colors"
              >
                <Square size={15} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!value.trim() || disabled}
                className="mb-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-hover disabled:opacity-30 disabled:hover:bg-accent transition-colors"
              >
                <Send size={15} />
              </button>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative" ref={modelRef}>
                <button
                  onClick={() => setModelMenuOpen((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-full border border-border-default px-3.5 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary transition-colors"
                >
                  <Bot size={14} />
                  <span>{selectedModel.label}</span>
                  <ChevronDown size={14} />
                </button>

                {modelMenuOpen && (
                  <div className="absolute bottom-full left-0 z-50 mb-2 w-56 rounded-xl border border-border-default bg-surface-2 p-1.5 shadow-xl">
                    {claudeModels.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedModel(model);
                          setModelMenuOpen(false);
                        }}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
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

            <div className="flex items-center gap-3">
              <div className="hidden sm:inline-flex items-center gap-1.5 text-sm text-text-muted">
                <Sparkles size={14} />
                Enter to send
              </div>
              <GitBranchSwitcher />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
