import React, { useCallback, useEffect, useState } from 'react';
import { BookOpenCheck, FolderOpen, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { Spinner } from '../common/Spinner';
import { ipc } from '../../lib/ipc-client';
import type { SkillSummary, SkillsOverview } from '../../../shared/skill-types';

type EditorMode = 'create' | 'edit';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong.';
}

function defaultSkillTemplate(skillName: string): string {
  return `# ${skillName}

One-line description.

## When to use
- Describe when this skill should be triggered.

## Instructions
- Describe the exact workflow the assistant should follow.
`;
}

function SkillCard({
  skill,
  actions,
}: {
  skill: SkillSummary;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-1/70 p-4">
      <p className="text-sm font-semibold text-text-primary">{skill.name}</p>
      <p className="mt-2 text-sm text-text-secondary">{skill.description}</p>
      <p className="mt-2 truncate text-xs text-text-muted">{skill.path}</p>
      {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SkillsPanel() {
  const [skills, setSkills] = useState<SkillsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [openingPath, setOpeningPath] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('create');
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingEditor, setLoadingEditor] = useState(false);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const response = await ipc().listSkills();
      setSkills(response);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSkills().catch(() => undefined);
  }, [loadSkills]);

  const closeEditor = useCallback(() => {
    if (saving || loadingEditor) return;
    setEditorOpen(false);
    setEditingSkillId(null);
    setDraftName('');
    setDraftContent('');
  }, [loadingEditor, saving]);

  const openCreateEditor = useCallback(() => {
    setEditorMode('create');
    setEditingSkillId(null);
    setDraftName('');
    setDraftContent(defaultSkillTemplate('my-skill'));
    setEditorOpen(true);
    setErrorMsg('');
  }, []);

  const openEditEditor = useCallback(async (skill: SkillSummary) => {
    setLoadingEditor(true);
    setErrorMsg('');

    try {
      const skillDoc = await ipc().readSkill(skill.id);
      setEditorMode('edit');
      setEditingSkillId(skillDoc.id);
      setDraftName(skillDoc.name);
      setDraftContent(skillDoc.content);
      setEditorOpen(true);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error));
    } finally {
      setLoadingEditor(false);
    }
  }, []);

  const handleOpenFolder = useCallback(async (skillPath: string) => {
    setOpeningPath(skillPath);
    setErrorMsg('');

    try {
      await ipc().openSkillFolder(skillPath);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error));
    } finally {
      setOpeningPath(null);
    }
  }, []);

  const handleDeleteSkill = useCallback(
    async (skill: SkillSummary) => {
      const confirmed = window.confirm(`Delete skill "${skill.name}"?`);
      if (!confirmed) return;

      setDeletingId(skill.id);
      setErrorMsg('');

      try {
        await ipc().deleteSkill(skill.id);
        await loadSkills();
      } catch (error: unknown) {
        setErrorMsg(getErrorMessage(error));
      } finally {
        setDeletingId(null);
      }
    },
    [loadSkills]
  );

  const handleSaveEditor = useCallback(async () => {
    setSaving(true);
    setErrorMsg('');

    try {
      if (editorMode === 'create') {
        if (!draftName.trim()) {
          throw new Error('Enter a skill name.');
        }
        await ipc().createSkill({ name: draftName, content: draftContent });
      } else {
        if (!editingSkillId) {
          throw new Error('No skill selected.');
        }
        await ipc().updateSkill({ skillId: editingSkillId, content: draftContent });
      }

      setEditorOpen(false);
      setEditingSkillId(null);
      setDraftName('');
      setDraftContent('');
      await loadSkills();
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }, [draftContent, draftName, editingSkillId, editorMode, loadSkills]);

  return (
    <div className="flex h-full flex-col bg-surface-0">
      <div className="flex items-center gap-2 border-b border-border-subtle bg-surface-1/50 glass px-6 py-3 [-webkit-app-region:drag]">
        <BookOpenCheck size={16} className="text-text-muted" />
        <h2 className="text-sm font-medium text-text-secondary">Skills</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl space-y-5">
          <section className="rounded-2xl border border-border-default bg-surface-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-text-primary">Skill Creator</p>
                <p className="mt-1 text-xs text-text-muted">
                  {skills ? `CODEX_HOME: ${skills.codexHome}` : 'Loading skill registry...'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => void loadSkills()} disabled={loading}>
                  Refresh
                </Button>
                <Button size="sm" icon={Plus} onClick={openCreateEditor} disabled={loading}>
                  New Skill
                </Button>
              </div>
            </div>

            {errorMsg && (
              <p className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                {errorMsg}
              </p>
            )}
          </section>

          {loading ? (
            <section className="flex items-center justify-center rounded-2xl border border-border-default bg-surface-1 p-12 text-sm text-text-secondary">
              <Spinner size={14} />
              <span className="ml-2">Loading skills...</span>
            </section>
          ) : (
            <>
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-text-primary">Your Skills</h3>
                  <span className="text-xs text-text-muted">{skills?.own.length || 0} skills</span>
                </div>

                {(skills?.own.length || 0) === 0 && (
                  <div className="rounded-xl border border-dashed border-border-default bg-surface-1/60 p-5 text-sm text-text-secondary">
                    You have no custom skills yet. Create one to get started.
                  </div>
                )}

                {(skills?.own || []).map((skill) => (
                  <SkillCard
                    key={`${skill.id}:${skill.path}`}
                    skill={skill}
                    actions={
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={FolderOpen}
                          onClick={() => void handleOpenFolder(skill.path)}
                          disabled={openingPath === skill.path}
                        >
                          {openingPath === skill.path ? 'Opening...' : 'Open Folder'}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Pencil}
                          onClick={() => void openEditEditor(skill)}
                          disabled={loadingEditor || saving}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          icon={Trash2}
                          onClick={() => void handleDeleteSkill(skill)}
                          disabled={deletingId === skill.id}
                        >
                          {deletingId === skill.id ? 'Removing...' : 'Remove'}
                        </Button>
                      </>
                    }
                  />
                ))}
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-text-primary">System Skills</h3>
                  <span className="text-xs text-text-muted">{skills?.system.length || 0} read-only</span>
                </div>

                {(skills?.system.length || 0) === 0 && (
                  <div className="rounded-xl border border-dashed border-border-default bg-surface-1/60 p-5 text-sm text-text-secondary">
                    No system skills were detected.
                  </div>
                )}

                {(skills?.system || []).map((skill) => (
                  <SkillCard
                    key={`${skill.id}:${skill.path}`}
                    skill={skill}
                    actions={
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={FolderOpen}
                        onClick={() => void handleOpenFolder(skill.path)}
                        disabled={openingPath === skill.path}
                      >
                        {openingPath === skill.path ? 'Opening...' : 'Open Folder'}
                      </Button>
                    }
                  />
                ))}
              </section>
            </>
          )}
        </div>
      </div>

      <Modal
        open={editorOpen}
        onClose={closeEditor}
        title={editorMode === 'create' ? 'Create Skill' : 'Edit Skill'}
      >
        <div className="space-y-4">
          {editorMode === 'create' ? (
            <Input
              label="Skill Name"
              placeholder="my-skill"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              autoFocus
            />
          ) : (
            <p className="text-sm text-text-secondary">
              Editing <span className="font-semibold text-text-primary">{draftName}</span>
            </p>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">SKILL.md</label>
            <textarea
              value={draftContent}
              onChange={(event) => setDraftContent(event.target.value)}
              rows={16}
              className="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/50"
              placeholder={defaultSkillTemplate(draftName || 'my-skill')}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={closeEditor} disabled={saving || loadingEditor}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void handleSaveEditor()} disabled={saving || loadingEditor}>
              {saving ? 'Saving...' : editorMode === 'create' ? 'Create Skill' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
