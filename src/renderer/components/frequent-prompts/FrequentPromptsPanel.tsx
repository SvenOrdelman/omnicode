import React, { useMemo, useState } from 'react';
import { Check, Edit3, MessageSquareText, Plus, Save, Trash2, X } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useFrequentPromptsStore } from '../../stores/frequent-prompts.store';

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function FrequentPromptsPanel() {
  const prompts = useFrequentPromptsStore((s) => s.prompts);
  const addPrompt = useFrequentPromptsStore((s) => s.addPrompt);
  const updatePrompt = useFrequentPromptsStore((s) => s.updatePrompt);
  const deletePrompt = useFrequentPromptsStore((s) => s.deletePrompt);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const sortedPrompts = useMemo(
    () => [...prompts].sort((a, b) => b.updatedAt - a.updatedAt),
    [prompts]
  );

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setEditingId(null);
    setError('');
  };

  const handleSubmit = () => {
    const trimmedTitle = title.trim();
    const trimmedMessage = message.trim();

    if (!trimmedTitle || !trimmedMessage) {
      setError('Both title and message are required.');
      return;
    }

    if (editingId) {
      updatePrompt(editingId, { title: trimmedTitle, message: trimmedMessage });
    } else {
      addPrompt({ title: trimmedTitle, message: trimmedMessage });
    }

    resetForm();
  };

  const isEditing = editingId !== null;

  return (
    <div className="flex h-full flex-col bg-surface-0">
      <div className="flex items-center gap-2 border-b border-border-subtle bg-surface-1/50 glass px-6 py-3 [-webkit-app-region:drag]">
        <MessageSquareText size={16} className="text-text-muted" />
        <h2 className="text-sm font-medium text-text-secondary">Frequent Prompts</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex h-full max-w-5xl flex-col space-y-5">
          <section className="rounded-2xl border border-border-default bg-surface-2 p-4">
            <div className="space-y-3">
              <Input
                label="Title"
                placeholder="e.g. Refactor review checklist"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    handleSubmit();
                  }
                }}
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-secondary">Message</label>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Write the full prompt message that should be sent from chat."
                  rows={5}
                  className="w-full resize-y rounded-lg border border-border-default bg-surface-1 px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/50"
                />
              </div>

              {error && (
                <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" icon={isEditing ? Save : Plus} onClick={handleSubmit}>
                  {isEditing ? 'Update prompt' : 'Add prompt'}
                </Button>
                {isEditing && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={X}
                    onClick={resetForm}
                  >
                    Cancel edit
                  </Button>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border-default bg-surface-1">
            {sortedPrompts.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-text-secondary">
                No frequent prompts yet. Add one above to start reusing prompts in chat.
              </div>
            ) : (
              <div className="divide-y divide-border-subtle">
                {sortedPrompts.map((prompt) => {
                  const currentlyEditing = editingId === prompt.id;

                  return (
                    <article key={prompt.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-semibold text-text-primary">{prompt.title}</h3>
                            {currentlyEditing && <Check size={14} className="text-success" />}
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">{prompt.message}</p>
                          <p className="mt-2 text-xs text-text-muted">Updated {formatTimestamp(prompt.updatedAt)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={Edit3}
                            onClick={() => {
                              setTitle(prompt.title);
                              setMessage(prompt.message);
                              setEditingId(prompt.id);
                              setError('');
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={Trash2}
                            onClick={() => {
                              deletePrompt(prompt.id);
                              if (editingId === prompt.id) {
                                resetForm();
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
