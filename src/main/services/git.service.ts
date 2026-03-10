import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

interface GitExecResult {
  stdout: string;
  stderr: string;
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
    const result = await runGit(cwd, ['status', '--porcelain']);
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
    return 'No diff available for this file.';
  }

  return sections.join('\n\n');
}
