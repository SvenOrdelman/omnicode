import React, { useMemo, useState } from 'react';
import { Edit3, MessageSquareText, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { useFrequentPromptsStore } from '../../stores/frequent-prompts.store';

type EditorMode = 'create' | 'edit';

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

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('create');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const sortedPrompts = useMemo(
    () => [...prompts].sort((a, b) => b.updatedAt - a.updatedAt),
    [prompts]
  );

  const resetEditor = () => {
    setTitle('');
    setMessage('');
    setEditingId(null);
    setError('');
  };

  const closeEditor = () => {
    setEditorOpen(false);
    resetEditor();
  };

  const openCreateEditor = () => {
    setEditorMode('create');
    resetEditor();
    setEditorOpen(true);
  };

  const openEditEditor = (id: string, currentTitle: string, currentMessage: string) => {
    setEditorMode('edit');
    setEditingId(id);
    setTitle(currentTitle);
    setMessage(currentMessage);
    setError('');
    setEditorOpen(true);
  };

  const handleSaveEditor = () => {
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

    closeEditor();
  };

  const handleDeletePrompt = (id: string) => {
    deletePrompt(id);
    if (editingId === id) {
      closeEditor();
    }
  };

  return (
    <div className="flex h-full flex-col bg-surface-0">
      <div className="flex items-center gap-2 border-b border-border-subtle bg-surface-1/50 glass px-6 py-3 [-webkit-app-region:drag]">
        <MessageSquareText size={16} className="text-text-muted" />
        <h2 className="text-sm font-medium text-text-secondary">Frequent Prompts</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex h-full max-w-5xl flex-col space-y-5">
          <section className="rounded-2xl border border-border-default bg-surface-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-text-primary">Prompt Library</p>
                <p className="mt-1 text-xs text-text-muted">Saved prompts you can reuse directly from chat.</p>
              </div>
              <Button size="sm" icon={Plus} onClick={openCreateEditor}>
                New Prompt
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border border-border-default bg-surface-1">
            {sortedPrompts.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-text-secondary">
                No frequent prompts yet. Create one to start reusing prompts in chat.
              </div>
            ) : (
              <div className="divide-y divide-border-subtle">
                {sortedPrompts.map((prompt) => {
                  return (
                    <article key={prompt.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-semibold text-text-primary">{prompt.title}</h3>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">{prompt.message}</p>
                          <p className="mt-2 text-xs text-text-muted">Updated {formatTimestamp(prompt.updatedAt)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={Edit3}
                            onClick={() => openEditEditor(prompt.id, prompt.title, prompt.message)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={Trash2}
                            onClick={() => handleDeletePrompt(prompt.id)}
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

      <Modal
        open={editorOpen}
        onClose={closeEditor}
        title={editorMode === 'create' ? 'New Frequent Prompt' : 'Edit Frequent Prompt'}
      >
        <div className="space-y-4">
          <Input
            label="Title"
            placeholder="e.g. Refactor review checklist"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                handleSaveEditor();
              }
            }}
            autoFocus
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Message</label>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Write the full prompt message that should be sent from chat."
              rows={8}
              className="w-full resize-y rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/50"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  handleSaveEditor();
                }
              }}
            />
          </div>

          {error && (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={closeEditor}>
              Cancel
            </Button>
            <Button size="sm" icon={editorMode === 'edit' ? Save : Plus} onClick={handleSaveEditor}>
              {editorMode === 'edit' ? 'Save Changes' : 'Create Prompt'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
