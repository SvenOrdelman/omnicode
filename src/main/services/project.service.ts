import { dialog } from 'electron';
import { v4 as uuid } from 'uuid';
import path from 'node:path';
import { getDatabase } from './database.service';
import type { Project } from '../../shared/project-types';

export async function openProjectDialog(): Promise<Project | null> {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Open Project Folder',
  });

  if (result.canceled || result.filePaths.length === 0) return null;

  const projectPath = result.filePaths[0];
  return upsertProject(projectPath);
}

export function upsertProject(projectPath: string): Project {
  const db = getDatabase();
  const now = Date.now();
  const name = path.basename(projectPath);

  const existing = db.prepare(
    'SELECT * FROM projects WHERE path = ?'
  ).get(projectPath) as any;

  if (existing) {
    db.prepare('UPDATE projects SET last_opened = ? WHERE id = ?').run(now, existing.id);
    return {
      id: existing.id,
      name: existing.name,
      path: existing.path,
      lastOpened: now,
      createdAt: existing.created_at,
    };
  }

  const id = uuid();
  db.prepare(
    'INSERT INTO projects (id, name, path, last_opened, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, name, projectPath, now, now);

  return { id, name, path: projectPath, lastOpened: now, createdAt: now };
}

export function listRecentProjects(limit = 10): Project[] {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT * FROM projects ORDER BY last_opened DESC LIMIT ?'
  ).all(limit) as any[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    path: r.path,
    lastOpened: r.last_opened,
    createdAt: r.created_at,
  }));
}
