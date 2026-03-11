import { shell } from 'electron';
import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { SkillDocument, SkillScope, SkillSummary, SkillsOverview } from '../../shared/skill-types';

const SKILL_FILE_NAME = 'SKILL.md';
const MAX_SCAN_DEPTH = 5;
const DESCRIPTION_LIMIT = 220;

function getCodexHome(): string {
  const configured = process.env.CODEX_HOME?.trim();
  if (configured) return path.resolve(configured);
  return path.join(os.homedir(), '.codex');
}

function getSkillsRoot(codexHome: string): string {
  return path.join(codexHome, 'skills');
}

function assertInsideBase(basePath: string, targetPath: string): void {
  const resolvedBase = path.resolve(basePath);
  const resolvedTarget = path.resolve(targetPath);
  if (resolvedTarget === resolvedBase) return;
  if (!resolvedTarget.startsWith(`${resolvedBase}${path.sep}`)) {
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

async function summarizeSkill(skillDocPath: string, rootPath: string): Promise<SkillSummary> {
  const skillDir = path.dirname(skillDocPath);
  const id = path.relative(rootPath, skillDir).split(path.sep).join('/');
  const name = path.basename(skillDir);
  const scope = getScopeFromId(id);

  let description = 'No description available.';
  try {
    const markdown = await fs.readFile(skillDocPath, 'utf8');
    description = extractDescription(markdown);
  } catch {
    // Ignore read issues and keep fallback description.
  }

  return { id, name, description, path: skillDir, scope };
}

function getSkillDocPath(skillsRoot: string, skillId: string): string {
  const normalizedId = normalizeRelativeId(skillId);
  const skillDirPath = path.resolve(skillsRoot, normalizedId);
  assertInsideBase(skillsRoot, skillDirPath);
  return path.join(skillDirPath, SKILL_FILE_NAME);
}

export async function listSkills(): Promise<SkillsOverview> {
  const codexHome = getCodexHome();
  const skillsRoot = getSkillsRoot(codexHome);

  const skillDocs = await listSkillMarkdownFiles(skillsRoot);
  const summaries = await Promise.all(skillDocs.map((skillDocPath) => summarizeSkill(skillDocPath, skillsRoot)));

  return {
    codexHome,
    own: summaries
      .filter((skill) => skill.scope === 'user')
      .sort((a, b) => a.name.localeCompare(b.name)),
    system: summaries
      .filter((skill) => skill.scope === 'system')
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function readSkill(skillId: string): Promise<SkillDocument> {
  const codexHome = getCodexHome();
  const skillsRoot = getSkillsRoot(codexHome);
  const skillDocPath = getSkillDocPath(skillsRoot, skillId);

  if (!(await pathExists(skillDocPath))) {
    throw new Error('Skill not found');
  }

  const [summary, content] = await Promise.all([
    summarizeSkill(skillDocPath, skillsRoot),
    fs.readFile(skillDocPath, 'utf8'),
  ]);

  return { ...summary, content };
}

export async function createSkill(name: string, content?: string): Promise<SkillSummary> {
  const codexHome = getCodexHome();
  const skillsRoot = getSkillsRoot(codexHome);
  const skillId = slugifySkillName(name);
  const skillDirPath = path.resolve(skillsRoot, skillId);
  const skillDocPath = path.join(skillDirPath, SKILL_FILE_NAME);

  assertInsideBase(skillsRoot, skillDirPath);

  if (await pathExists(skillDocPath)) {
    throw new Error(`Skill "${skillId}" already exists`);
  }

  await fs.mkdir(skillDirPath, { recursive: true });
  await fs.writeFile(skillDocPath, content?.trim() || buildDefaultSkillContent(name), 'utf8');

  return summarizeSkill(skillDocPath, skillsRoot);
}

export async function updateSkill(skillId: string, content: string): Promise<SkillSummary> {
  const normalizedId = normalizeRelativeId(skillId);
  if (isSystemSkillId(normalizedId)) {
    throw new Error('System skills are read-only');
  }

  const codexHome = getCodexHome();
  const skillsRoot = getSkillsRoot(codexHome);
  const skillDocPath = getSkillDocPath(skillsRoot, normalizedId);

  if (!(await pathExists(skillDocPath))) {
    throw new Error('Skill not found');
  }

  await fs.writeFile(skillDocPath, content, 'utf8');
  return summarizeSkill(skillDocPath, skillsRoot);
}

export async function deleteSkill(skillId: string): Promise<{ ok: true }> {
  const normalizedId = normalizeRelativeId(skillId);
  if (isSystemSkillId(normalizedId)) {
    throw new Error('System skills cannot be deleted');
  }

  const codexHome = getCodexHome();
  const skillsRoot = getSkillsRoot(codexHome);
  const skillDocPath = getSkillDocPath(skillsRoot, normalizedId);
  const skillDirPath = path.dirname(skillDocPath);

  if (!(await pathExists(skillDocPath))) {
    throw new Error('Skill not found');
  }

  await fs.rm(skillDirPath, { recursive: true, force: true });
  return { ok: true };
}

export async function openSkillFolder(skillPath: string): Promise<{ ok: true }> {
  const codexHome = getCodexHome();
  const skillsRoot = getSkillsRoot(codexHome);
  const resolvedSkillPath = path.resolve(skillPath);
  const skillDocPath = path.join(resolvedSkillPath, SKILL_FILE_NAME);

  assertInsideBase(skillsRoot, resolvedSkillPath);

  if (!(await pathExists(skillDocPath))) {
    throw new Error('Skill not found');
  }

  shell.showItemInFolder(skillDocPath);
  return { ok: true };
}
