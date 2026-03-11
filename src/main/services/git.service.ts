import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

interface GitExecResult {
  stdout: string;
  stderr: string;
}

function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, '\n');
}

export interface GitBranchInfo {
  branches: string[];
  current: string | null;
}

export interface GitChangedFile {
  path: string;
  status: string;
  staged: string;
  unstaged: string;
}

export interface GitFileView {
  content: string;
  baseContent: string;
  addedLines: number[];
  removedLines: number[];
  source: 'working_tree' | 'head';
}

export interface GitCommitParams {
  title: string;
  message?: string;
  filePaths: string[];
}

export interface GitPushParams {
  remote?: string;
  branch?: string;
}

function ensureInsideRepo(cwd: string, filePath: string): string {
  const root = path.resolve(cwd);
  const absolute = path.resolve(root, filePath);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    throw new Error('Invalid file path');
  }
  return absolute;
}

function runGit(cwd: string, args: string[]): Promise<GitExecResult> {
  return new Promise((resolve, reject) => {
    execFile('git', ['-C', cwd, ...args], { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error((stderr || error.message).trim()));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

export async function listGitBranches(cwd: string): Promise<GitBranchInfo> {
  try {
    const [currentResult, branchesResult] = await Promise.all([
      runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']),
      runGit(cwd, ['for-each-ref', '--format=%(refname:short)', '--sort=-committerdate', 'refs/heads']),
    ]);

    const current = currentResult.stdout.trim() || null;
    const branches = branchesResult.stdout
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    return { branches, current };
  } catch {
    // Not a git repo or git is unavailable in PATH.
    return { branches: [], current: null };
  }
}

export async function switchGitBranch(cwd: string, branch: string): Promise<void> {
  await runGit(cwd, ['checkout', branch]);
}

function parseChangedPath(rawPath: string): string {
  const renameSeparator = ' -> ';
  if (rawPath.includes(renameSeparator)) {
    return rawPath.split(renameSeparator).at(-1)?.trim() || rawPath.trim();
  }
  return rawPath.trim();
}

function describeStatus(staged: string, unstaged: string): string {
  if (staged === '?' && unstaged === '?') return 'untracked';
  if (staged === 'A' || unstaged === 'A') return 'added';
  if (staged === 'D' || unstaged === 'D') return 'deleted';
  if (staged === 'R' || unstaged === 'R') return 'renamed';
  if (staged === 'M' || unstaged === 'M') return 'modified';
  return 'changed';
}

export async function listGitChanges(cwd: string): Promise<GitChangedFile[]> {
  try {
    const result = await runGit(cwd, ['status', '--porcelain', '--untracked-files=all']);
    const changes = result.stdout
      .split('\n')
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .map((line) => {
        const staged = line[0] || ' ';
        const unstaged = line[1] || ' ';
        const filePath = parseChangedPath(line.slice(3));
        return {
          path: filePath,
          staged,
          unstaged,
          status: describeStatus(staged, unstaged),
        };
      })
      .filter((entry) => Boolean(entry.path))
      .sort((a, b) => a.path.localeCompare(b.path));

    return changes;
  } catch {
    return [];
  }
}

function createUntrackedDiff(filePath: string, content: string): string {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const body = lines.map((line) => `+${line}`).join('\n');
  return [
    `diff --git a/${filePath} b/${filePath}`,
    'new file mode 100644',
    '--- /dev/null',
    `+++ b/${filePath}`,
    '@@ -0,0 +1 @@',
    body,
  ].join('\n');
}

export async function getGitDiff(cwd: string, filePath: string): Promise<string> {
  const [stagedDiff, unstagedDiff, statusOutput] = await Promise.all([
    runGit(cwd, ['diff', '--no-color', '--cached', '--', filePath]).then((r) => r.stdout).catch(() => ''),
    runGit(cwd, ['diff', '--no-color', '--', filePath]).then((r) => r.stdout).catch(() => ''),
    runGit(cwd, ['status', '--porcelain', '--', filePath]).then((r) => r.stdout).catch(() => ''),
  ]);

  const sections: string[] = [];

  if (stagedDiff.trim()) {
    sections.push(`### Staged\n\n${stagedDiff.trimEnd()}`);
  }
  if (unstagedDiff.trim()) {
    sections.push(`### Working Tree\n\n${unstagedDiff.trimEnd()}`);
  }

  if (!sections.length && statusOutput.trim().startsWith('??')) {
    try {
      const absolute = path.resolve(cwd, filePath);
      const content = await fs.readFile(absolute, 'utf8');
      sections.push(`### Untracked\n\n${createUntrackedDiff(filePath, content)}`);
    } catch {
      sections.push('Untracked file. Diff preview is unavailable.');
    }
  }

  if (!sections.length) {
    return 'No diff availables for this file.';
  }

  return sections.join('\n\n');
}

function parseLineChanges(diff: string): { addedLines: number[]; removedLines: number[] } {
  const added = new Set<number>();
  const removed = new Set<number>();
  const lines = diff.split('\n');
  let currentNewLine = 0;
  let inHunk = false;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      const match = /@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      if (match) {
        currentNewLine = Number(match[1]);
        inHunk = true;
      }
      continue;
    }

    if (!inHunk) continue;

    if (line.startsWith('+') && !line.startsWith('+++')) {
      added.add(currentNewLine);
      currentNewLine += 1;
      continue;
    }

    if (line.startsWith('-') && !line.startsWith('---')) {
      // Removed lines don't exist in the new file, so anchor them to the current new-file line.
      removed.add(Math.max(1, currentNewLine));
      continue;
    }

    if (!line.startsWith('\\')) {
      currentNewLine += 1;
    }
  }

  return {
    addedLines: Array.from(added).sort((a, b) => a - b),
    removedLines: Array.from(removed).sort((a, b) => a - b),
  };
}

async function readHeadFile(cwd: string, filePath: string): Promise<string> {
  const result = await runGit(cwd, ['show', `HEAD:${filePath}`]);
  return result.stdout;
}

async function readWorkingTreeFile(cwd: string, filePath: string): Promise<string> {
  const absolute = ensureInsideRepo(cwd, filePath);
  return fs.readFile(absolute, 'utf8');
}

export async function getGitFileView(cwd: string, filePath: string): Promise<GitFileView> {
  const status = await runGit(cwd, ['status', '--porcelain', '--', filePath]).then((r) => r.stdout.trim()).catch(() => '');
  const diff = await runGit(cwd, ['diff', '--no-color', '--', filePath]).then((r) => r.stdout).catch(() => '');
  const isUntracked = status.startsWith('??');
  const { addedLines, removedLines } = parseLineChanges(diff);
  const headContent = await readHeadFile(cwd, filePath).catch(() => '');

  try {
    const content = normalizeLineEndings(await readWorkingTreeFile(cwd, filePath));
    const linesCount = content.length > 0 ? content.split('\n').length : 0;
    return {
      content,
      baseContent: isUntracked ? '' : normalizeLineEndings(headContent),
      addedLines: isUntracked ? Array.from({ length: linesCount }, (_, i) => i + 1) : addedLines,
      removedLines: isUntracked ? [] : removedLines,
      source: 'working_tree',
    };
  } catch {
    return {
      content: '',
      baseContent: normalizeLineEndings(headContent) || 'File content is unavailable.',
      addedLines,
      removedLines,
      source: 'head',
    };
  }
}

export async function acceptGitFile(cwd: string, filePath: string): Promise<void> {
  await runGit(cwd, ['add', '--', filePath]);
}

export async function rejectGitFile(cwd: string, filePath: string): Promise<void> {
  const status = await runGit(cwd, ['status', '--porcelain', '--', filePath]).then((r) => r.stdout).catch(() => '');
  const trimmed = status.trim();

  if (trimmed.startsWith('??')) {
    const absolute = ensureInsideRepo(cwd, filePath);
    await fs.rm(absolute, { force: true, recursive: true });
    return;
  }

  try {
    await runGit(cwd, ['restore', '--staged', '--worktree', '--', filePath]);
    return;
  } catch {
    // Fallback for older git setups.
  }

  await runGit(cwd, ['checkout', '--', filePath]);
  await runGit(cwd, ['reset', 'HEAD', '--', filePath]).catch(() => '');
}

function toSafePathSpecs(cwd: string, filePaths: string[]): string[] {
  const root = path.resolve(cwd);
  const pathSpecs = filePaths
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const absolute = ensureInsideRepo(root, entry);
      const relative = path.relative(root, absolute);
      return relative.split(path.sep).join('/');
    })
    .filter(Boolean);

  return Array.from(new Set(pathSpecs));
}

export async function commitGitChanges(cwd: string, params: GitCommitParams): Promise<void> {
  const title = params.title.trim();
  if (!title) {
    throw new Error('Commit title is required.');
  }

  const pathSpecs = toSafePathSpecs(cwd, params.filePaths);
  if (pathSpecs.length === 0) {
    throw new Error('Select at least one file to commit.');
  }

  // Stage selected paths first so untracked files are recognized by git commit pathspecs.
  await runGit(cwd, ['add', '--', ...pathSpecs]);

  const args = ['commit', '-m', title];
  const message = params.message?.trim();
  if (message) {
    args.push('-m', message);
  }
  args.push('--', ...pathSpecs);

  await runGit(cwd, args);
}

export async function pushGitChanges(cwd: string, params?: GitPushParams): Promise<void> {
  const remote = params?.remote?.trim() ?? '';
  const branch = params?.branch?.trim() ?? '';

  if (!remote && !branch) {
    await runGit(cwd, ['push']);
    return;
  }

  const resolvedRemote = remote || 'origin';
  if (branch) {
    await runGit(cwd, ['push', resolvedRemote, branch]);
    return;
  }

  await runGit(cwd, ['push', resolvedRemote]);
}

export async function fetchGitChanges(cwd: string): Promise<void> {
  await runGit(cwd, ['fetch', '--all', '--prune']);
}
