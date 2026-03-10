import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';

const MAX_FILES = 12000;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_SEARCH_RESULTS = 120;
const IGNORED_DIRS = new Set(['.git', 'node_modules', '.vite', 'dist']);

function runCommand(cmd: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error((stderr || error.message).trim()));
        return;
      }
      resolve(stdout);
    });
  });
}

function ensureInsideProject(cwd: string, relativeFilePath: string): string {
  const basePath = path.resolve(cwd);
  const absolutePath = path.resolve(basePath, relativeFilePath);
  if (absolutePath !== basePath && !absolutePath.startsWith(`${basePath}${path.sep}`)) {
    throw new Error('Invalid file path');
  }
  return absolutePath;
}

async function fallbackListFiles(cwd: string): Promise<string[]> {
  const root = path.resolve(cwd);
  const files: string[] = [];
  const stack: string[] = [root];

  while (stack.length > 0 && files.length < MAX_FILES) {
    const currentDir = stack.pop();
    if (!currentDir) break;

    let entries: Dirent[];
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (files.length >= MAX_FILES) break;
      const fullPath = path.join(currentDir, entry.name);
      const relative = path.relative(root, fullPath);

      if (!relative || relative.startsWith('..')) continue;

      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        stack.push(fullPath);
        continue;
      }

      if (entry.isFile()) {
        files.push(relative);
      }
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

export async function listProjectFiles(cwd: string): Promise<string[]> {
  try {
    const stdout = await runCommand('rg', ['--files', '--hidden', '-g', '!.git', '-g', '!node_modules'], cwd);
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, MAX_FILES);
  } catch {
    return fallbackListFiles(cwd);
  }
}

export async function readProjectFile(cwd: string, relativeFilePath: string): Promise<{ content: string; truncated: boolean }> {
  const absolutePath = ensureInsideProject(cwd, relativeFilePath);
  const fileBuffer = await fs.readFile(absolutePath);
  const truncated = fileBuffer.byteLength > MAX_FILE_BYTES;
  const content = fileBuffer.subarray(0, MAX_FILE_BYTES).toString('utf8');
  return { content, truncated };
}

export async function writeProjectFile(cwd: string, relativeFilePath: string, content: string): Promise<void> {
  const absolutePath = ensureInsideProject(cwd, relativeFilePath);
  await fs.writeFile(absolutePath, content, 'utf8');
}

export interface ExplorerSearchResult {
  filePath: string;
  line: number;
  column: number;
  preview: string;
}

interface RipgrepMatchRecord {
  type?: string;
  data?: {
    path?: { text?: string };
    line_number?: number;
    lines?: { text?: string };
    submatches?: Array<{ start?: number }>;
  };
}

function normalizePreview(line: string): string {
  const compact = line.replace(/\r?\n/g, ' ').trim();
  return compact || '(empty line)';
}

export async function searchProjectContent(cwd: string, query: string): Promise<ExplorerSearchResult[]> {
  const needle = query.trim();
  if (needle.length < 2) return [];

  try {
    const stdout = await runCommand(
      'rg',
      [
        '--json',
        '--line-number',
        '--column',
        '--fixed-strings',
        '--smart-case',
        '--max-count',
        '4',
        '--max-columns',
        '300',
        '--hidden',
        '-g',
        '!.git',
        '-g',
        '!node_modules',
        '-g',
        '!.vite',
        '-g',
        '!dist',
        needle,
        '.',
      ],
      cwd
    );

    const results: ExplorerSearchResult[] = [];
    const seen = new Set<string>();

    for (const record of stdout.split('\n')) {
      if (!record.trim()) continue;

      let parsed: RipgrepMatchRecord;
      try {
        parsed = JSON.parse(record) as RipgrepMatchRecord;
      } catch {
        continue;
      }

      if (parsed?.type !== 'match') continue;

      const filePath = parsed?.data?.path?.text as string | undefined;
      const line = Number(parsed?.data?.line_number);
      const preview = normalizePreview(String(parsed?.data?.lines?.text ?? ''));
      const firstSubMatch = Array.isArray(parsed?.data?.submatches)
        ? parsed.data.submatches[0]
        : undefined;
      const column = Number(firstSubMatch?.start ?? 0) + 1;

      if (!filePath || !Number.isFinite(line)) continue;

      const key = `${filePath}:${line}:${column}`;
      if (seen.has(key)) continue;
      seen.add(key);

      results.push({
        filePath,
        line,
        column: Number.isFinite(column) ? column : 1,
        preview,
      });

      if (results.length >= MAX_SEARCH_RESULTS) break;
    }

    return results;
  } catch {
    const fallback = await listProjectFiles(cwd).catch(() => []);
    return fallback
      .filter((filePath) => filePath.toLowerCase().includes(needle.toLowerCase()))
      .slice(0, MAX_SEARCH_RESULTS)
      .map((filePath) => ({
        filePath,
        line: 1,
        column: 1,
        preview: filePath,
      }));
  }
}
