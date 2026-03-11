import { shell } from 'electron';
import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { SkillDocument, SkillRoot, SkillScope, SkillSummary, SkillsOverview } from '../../shared/skill-types';
import { getDatabase } from './database.service';

const SKILL_FILE_NAME = 'SKILL.md';
const MAX_SCAN_DEPTH = 5;
const DESCRIPTION_LIMIT = 220;

type SkillRegistry = {
  claudeHome: string;
  codexHome: string;
  roots: SkillRoot[];
};

function getCodexHome(): string {
  const configured = process.env.CODEX_HOME?.trim();
  if (configured) return path.resolve(configured);
  return path.join(os.homedir(), '.codex');
}

function getClaudeHome(): string {
  const configured = process.env.CLAUDE_CONFIG_DIR?.trim() || process.env.CLAUDE_HOME?.trim();
  if (configured) return path.resolve(configured);
  return path.join(os.homedir(), '.claude');
}

function getSkillsRoot(homePath: string): string {
  return path.join(homePath, 'skills');
}

function getProjectSkillRoots(): SkillRoot[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT id, name, path FROM projects ORDER BY last_opened DESC').all() as Array<{
    id: string;
    name: string;
    path: string;
  }>;

  return rows.map((row) => ({
    key: `project-${row.id}`,
    label: `Project: ${row.name}`,
    path: path.join(row.path, '.claude', 'skills'),
    writable: true,
    createTarget: false,
  }));
}

function dedupeSkillRoots(roots: SkillRoot[]): SkillRoot[] {
  const seen = new Set<string>();
  const deduped: SkillRoot[] = [];

  for (const root of roots) {
    const resolvedPath = path.resolve(root.path);
    if (seen.has(resolvedPath)) {
      continue;
    }

    seen.add(resolvedPath);
    deduped.push({ ...root, path: resolvedPath });
  }

  return deduped;
}

function getSkillRegistry(): SkillRegistry {
  const claudeHome = getClaudeHome();
  const codexHome = getCodexHome();

  const roots = dedupeSkillRoots([
    {
      key: 'claude-global',
      label: 'Claude Global',
      path: getSkillsRoot(claudeHome),
      writable: true,
      createTarget: true,
    },
    ...getProjectSkillRoots(),
    {
      key: 'legacy-codex',
      label: 'Legacy Codex',
      path: getSkillsRoot(codexHome),
      writable: true,
      createTarget: false,
    },
  ]);

  return { claudeHome, codexHome, roots };
}

function isInsideBase(basePath: string, targetPath: string): boolean {
  const resolvedBase = path.resolve(basePath);
  const resolvedTarget = path.resolve(targetPath);
  if (resolvedTarget === resolvedBase) return true;
  return resolvedTarget.startsWith(`${resolvedBase}${path.sep}`);
}

function assertInsideBase(basePath: string, targetPath: string): void {
  if (!isInsideBase(basePath, targetPath)) {
    throw new Error('Invalid path');
  }
}

function normalizeRelativeId(rawId: string): string {
  const normalized = rawId.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized || normalized.includes('..')) {
    throw new Error('Invalid skill id');
  }
  return normalized;
}

function isSystemSkillId(skillId: string): boolean {
  return skillId === '.system' || skillId.startsWith('.system/');
}

function slugifySkillName(rawName: string): string {
  const normalized = rawName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!normalized) {
    throw new Error('Enter a valid skill name');
  }

  if (normalized.startsWith('.')) {
    throw new Error('Skill name cannot start with a dot');
  }

  return normalized;
}

function buildDefaultSkillContent(name: string): string {
  return `# ${name.trim()}

Short description.

## When to use
- Describe the trigger conditions.

## Instructions
- Describe the workflow to follow.
`;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function listSkillMarkdownFiles(rootPath: string): Promise<string[]> {
  if (!(await pathExists(rootPath))) return [];

  const queue: Array<{ dir: string; depth: number }> = [{ dir: rootPath, depth: 0 }];
  const results: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    let entries: Dirent[];
    try {
      entries = await fs.readdir(current.dir, { withFileTypes: true });
    } catch {
      continue;
    }

    const hasSkillDoc = entries.some((entry) => entry.isFile() && entry.name === SKILL_FILE_NAME);
    if (hasSkillDoc) {
      results.push(path.join(current.dir, SKILL_FILE_NAME));
      continue;
    }

    if (current.depth >= MAX_SCAN_DEPTH) {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      queue.push({ dir: path.join(current.dir, entry.name), depth: current.depth + 1 });
    }
  }

  return results.sort((a, b) => a.localeCompare(b));
}

function extractDescription(markdown: string): string {
  const lines = markdown.split(/\r?\n/).map((line) => line.trim());
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (
      !line ||
      inCodeBlock ||
      line.startsWith('#') ||
      line.startsWith('>') ||
      line.startsWith('- ') ||
      line.startsWith('* ') ||
      line.startsWith('|')
    ) {
      continue;
    }

    return line.length > DESCRIPTION_LIMIT ? `${line.slice(0, DESCRIPTION_LIMIT - 3)}...` : line;
  }

  const heading = lines.find((line) => line.startsWith('#'));
  if (!heading) return 'No description available.';
  const normalizedHeading = heading.replace(/^#+\s*/, '').trim();
  return normalizedHeading || 'No description available.';
}

function getScopeFromId(skillId: string): SkillScope {
  return isSystemSkillId(skillId) ? 'system' : 'user';
}

function getSkillDocPath(skillsRoot: string, skillId: string): string {
  const normalizedId = normalizeRelativeId(skillId);
  const skillDirPath = path.resolve(skillsRoot, normalizedId);
  assertInsideBase(skillsRoot, skillDirPath);
  return path.join(skillDirPath, SKILL_FILE_NAME);
}

function getRootByKey(roots: SkillRoot[], rootKey: string): SkillRoot {
  const root = roots.find((candidate) => candidate.key === rootKey);
  if (!root) {
    throw new Error('Skill source not found');
  }
  return root;
}

async function resolveSkillLocation(
  skillId: string,
  roots: SkillRoot[]
): Promise<{ root: SkillRoot; relativeId: string; skillDocPath: string }> {
  const separatorIndex = skillId.indexOf(':');

  if (separatorIndex > 0) {
    const rootKey = skillId.slice(0, separatorIndex);
    const relativeId = normalizeRelativeId(skillId.slice(separatorIndex + 1));
    const root = getRootByKey(roots, rootKey);
    return {
      root,
      relativeId,
      skillDocPath: getSkillDocPath(root.path, relativeId),
    };
  }

  const relativeId = normalizeRelativeId(skillId);

  for (const root of roots) {
    const skillDocPath = getSkillDocPath(root.path, relativeId);
    if (await pathExists(skillDocPath)) {
      return { root, relativeId, skillDocPath };
    }
  }

  const fallback = roots.find((root) => root.key === 'legacy-codex') || roots[0];
  if (!fallback) {
    throw new Error('No skill sources available');
  }

  return {
    root: fallback,
    relativeId,
    skillDocPath: getSkillDocPath(fallback.path, relativeId),
  };
}

async function summarizeSkill(skillDocPath: string, root: SkillRoot): Promise<SkillSummary> {
  const skillDir = path.dirname(skillDocPath);
  const relativeId = path.relative(root.path, skillDir).split(path.sep).join('/');
  const name = path.basename(skillDir);
  const scope = getScopeFromId(relativeId);

  let description = 'No description available.';
  try {
    const markdown = await fs.readFile(skillDocPath, 'utf8');
    description = extractDescription(markdown);
  } catch {
    // Ignore read issues and keep fallback description.
  }

  return {
    id: `${root.key}:${relativeId}`,
    name,
    description,
    path: skillDir,
    origin: root.label,
    scope,
  };
}

export async function listSkills(): Promise<SkillsOverview> {
  const registry = getSkillRegistry();

  const skillsPerRoot = await Promise.all(
    registry.roots.map(async (root) => {
      const skillDocs = await listSkillMarkdownFiles(root.path);
      return { root, skillDocs };
    })
  );

  const summaries = await Promise.all(
    skillsPerRoot.flatMap(({ root, skillDocs }) => skillDocs.map((skillDocPath) => summarizeSkill(skillDocPath, root)))
  );

  return {
    codexHome: registry.codexHome,
    claudeHome: registry.claudeHome,
    roots: registry.roots,
    own: summaries
      .filter((skill) => skill.scope === 'user')
      .sort((a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path)),
    system: summaries
      .filter((skill) => skill.scope === 'system')
      .sort((a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path)),
  };
}

export async function readSkill(skillId: string): Promise<SkillDocument> {
  const registry = getSkillRegistry();
  const location = await resolveSkillLocation(skillId, registry.roots);

  if (!(await pathExists(location.skillDocPath))) {
    throw new Error('Skill not found');
  }

  const [summary, content] = await Promise.all([
    summarizeSkill(location.skillDocPath, location.root),
    fs.readFile(location.skillDocPath, 'utf8'),
  ]);

  return { ...summary, content };
}

export async function createSkill(name: string, content?: string, rootKey?: string): Promise<SkillSummary> {
  const registry = getSkillRegistry();
  const createRoot = rootKey
    ? getRootByKey(registry.roots, rootKey)
    : registry.roots.find((root) => root.createTarget) || registry.roots[0];

  if (!createRoot) {
    throw new Error('No skill sources available');
  }

  if (!createRoot.writable) {
    throw new Error('Primary skill source is read-only');
  }

  const skillId = slugifySkillName(name);
  const skillDirPath = path.resolve(createRoot.path, skillId);
  const skillDocPath = path.join(skillDirPath, SKILL_FILE_NAME);

  assertInsideBase(createRoot.path, skillDirPath);

  if (await pathExists(skillDocPath)) {
    throw new Error(`Skill "${skillId}" already exists`);
  }

  await fs.mkdir(skillDirPath, { recursive: true });
  await fs.writeFile(skillDocPath, content?.trim() || buildDefaultSkillContent(name), 'utf8');

  return summarizeSkill(skillDocPath, createRoot);
}

export async function updateSkill(skillId: string, content: string): Promise<SkillSummary> {
  const registry = getSkillRegistry();
  const location = await resolveSkillLocation(skillId, registry.roots);

  if (isSystemSkillId(location.relativeId)) {
    throw new Error('System skills are read-only');
  }

  if (!location.root.writable) {
    throw new Error('This skill source is read-only');
  }

  if (!(await pathExists(location.skillDocPath))) {
    throw new Error('Skill not found');
  }

  await fs.writeFile(location.skillDocPath, content, 'utf8');
  return summarizeSkill(location.skillDocPath, location.root);
}

export async function deleteSkill(skillId: string): Promise<{ ok: true }> {
  const registry = getSkillRegistry();
  const location = await resolveSkillLocation(skillId, registry.roots);

  if (isSystemSkillId(location.relativeId)) {
    throw new Error('System skills cannot be deleted');
  }

  if (!location.root.writable) {
    throw new Error('This skill source is read-only');
  }

  if (!(await pathExists(location.skillDocPath))) {
    throw new Error('Skill not found');
  }

  await fs.rm(path.dirname(location.skillDocPath), { recursive: true, force: true });
  return { ok: true };
}

export async function openSkillFolder(skillPath: string): Promise<{ ok: true }> {
  const registry = getSkillRegistry();
  const resolvedSkillPath = path.resolve(skillPath);
  const skillDocPath = path.join(resolvedSkillPath, SKILL_FILE_NAME);

  const isAllowedPath = registry.roots.some((root) => isInsideBase(root.path, resolvedSkillPath));
  if (!isAllowedPath) {
    throw new Error('Invalid path');
  }

  if (!(await pathExists(skillDocPath))) {
    throw new Error('Skill not found');
  }

  shell.showItemInFolder(skillDocPath);
  return { ok: true };
}
