import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, FolderOpen, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { Spinner } from '../common/Spinner';
import { ipc } from '../../lib/ipc-client';
import type { SkillRoot, SkillSummary, SkillsOverview } from '../../../shared/skill-types';

type EditorMode = 'create' | 'edit';
type SkillGroup = {
  key: string;
  label: string;
  path: string;
  skills: SkillSummary[];
};

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

function getRootKeyFromSkillId(skillId: string): string | null {
  const separatorIndex = skillId.indexOf(':');
  if (separatorIndex <= 0) return null;
  return skillId.slice(0, separatorIndex);
}

function getRepoDisplayPath(sourceLabel: string, sourcePath: string): string {
  if (!sourceLabel.startsWith('Project: ')) {
    return sourcePath;
  }

  return sourcePath.replace(/[\\/]\.claude[\\/]skills$/, '');
}

function getDefaultCreateRootKey(overview: SkillsOverview | null): string {
  if (!overview) return '';
  const preferred = overview.roots.find((root) => root.writable && root.createTarget);
  if (preferred) return preferred.key;
  const firstWritable = overview.roots.find((root) => root.writable);
  return firstWritable?.key || '';
}

function getCreateRootPath(root: SkillRoot): string {
  return getRepoDisplayPath(root.label, root.path);
}

function groupSkillsBySource(skills: SkillSummary[], overview: SkillsOverview | null): SkillGroup[] {
  if (!overview) return [];

  const groups = new Map<string, SkillGroup>();

  for (const root of overview.roots) {
    groups.set(root.key, {
      key: root.key,
      label: root.label,
      path: getRepoDisplayPath(root.label, root.path),
      skills: [],
    });
  }

  for (const skill of skills) {
    const rootKey = getRootKeyFromSkillId(skill.id);
    if (!rootKey) {
      const fallbackKey = `fallback:${skill.origin}`;
      const fallback = groups.get(fallbackKey) || {
        key: fallbackKey,
        label: skill.origin,
        path: skill.path,
        skills: [],
      };
      fallback.skills.push(skill);
      groups.set(fallbackKey, fallback);
      continue;
    }

    const rootGroup = groups.get(rootKey);
    if (!rootGroup) {
      const unknown = groups.get(rootKey) || {
        key: rootKey,
        label: skill.origin,
        path: skill.path,
        skills: [],
      };
      unknown.skills.push(skill);
      groups.set(rootKey, unknown);
      continue;
    }

    rootGroup.skills.push(skill);
  }

  return Array.from(groups.values())
    .filter((group) => group.skills.length > 0)
    .map((group) => ({
      ...group,
      skills: [...group.skills].sort((a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path)),
    }));
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
      <p className="mt-2 text-xs text-text-muted">Source: {skill.origin}</p>
      <p className="mt-1 truncate text-xs text-text-muted">{skill.path}</p>
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
  const [draftRootKey, setDraftRootKey] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingEditor, setLoadingEditor] = useState(false);

  const ownSkillGroups = useMemo(() => groupSkillsBySource(skills?.own || [], skills), [skills]);
  const systemSkillGroups = useMemo(() => groupSkillsBySource(skills?.system || [], skills), [skills]);
  const writableRoots = useMemo(() => (skills?.roots || []).filter((root) => root.writable), [skills]);
  const selectedCreateRoot = useMemo(
    () => writableRoots.find((root) => root.key === draftRootKey) || null,
    [draftRootKey, writableRoots]
  );

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
    setDraftRootKey('');
    setDraftContent('');
  }, [loadingEditor, saving]);

  const openCreateEditor = useCallback(() => {
    setEditorMode('create');
    setEditingSkillId(null);
    setDraftName('');
    setDraftRootKey(getDefaultCreateRootKey(skills));
    setDraftContent(defaultSkillTemplate('my-skill'));
    setEditorOpen(true);
    setErrorMsg('');
  }, [skills]);

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
        if (!draftRootKey) {
          throw new Error('Choose where to create this skill.');
        }
        await ipc().createSkill({ name: draftName, content: draftContent, rootKey: draftRootKey });
      } else {
        if (!editingSkillId) {
          throw new Error('No skill selected.');
        }
        await ipc().updateSkill({ skillId: editingSkillId, content: draftContent });
      }

      setEditorOpen(false);
      setEditingSkillId(null);
      setDraftName('');
      setDraftRootKey('');
      setDraftContent('');
      await loadSkills();
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }, [draftContent, draftName, draftRootKey, editingSkillId, editorMode, loadSkills]);

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
                  {skills
                    ? `CLAUDE_HOME: ${skills.claudeHome} • Sources: ${skills.roots.length}`
                    : 'Loading skill registry...'}
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

                {ownSkillGroups.map((group) => (
                  <div key={group.key} className="space-y-3 rounded-xl border border-border-default bg-surface-1/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-text-primary">{group.label}</p>
                      <span className="text-xs text-text-muted">{group.skills.length} skill(s)</span>
                    </div>
                    <p className="truncate text-xs text-text-muted">{group.path}</p>
                    <div className="space-y-3">
                      {group.skills.map((skill) => (
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
                    </div>
                  </div>
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

                {systemSkillGroups.map((group) => (
                  <div key={group.key} className="space-y-3 rounded-xl border border-border-default bg-surface-1/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-text-primary">{group.label}</p>
                      <span className="text-xs text-text-muted">{group.skills.length} skill(s)</span>
                    </div>
                    <p className="truncate text-xs text-text-muted">{group.path}</p>
                    <div className="space-y-3">
                      {group.skills.map((skill) => (
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
                    </div>
                  </div>
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
        maxWidthClass="w-[min(96vw,1100px)] max-w-none"
      >
        <div className="space-y-4">
          {editorMode === 'create' ? (
            <div className="space-y-4">
              <Input
                label="Skill Name"
                placeholder="my-skill"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                autoFocus
              />

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-secondary">Location</label>
                <select
                  value={draftRootKey}
                  onChange={(event) => setDraftRootKey(event.target.value)}
                  className="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/50"
                >
                  <option value="" disabled>
                    Select skill location
                  </option>
                  {writableRoots.map((root) => (
                    <option key={root.key} value={root.key}>
                      {root.label}
                    </option>
                  ))}
                </select>
                {selectedCreateRoot && (
                  <p className="text-xs text-text-muted">Path: {getCreateRootPath(selectedCreateRoot)}</p>
                )}
              </div>
            </div>
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
              rows={22}
              className="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2 font-mono text-sm leading-relaxed text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/50"
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
