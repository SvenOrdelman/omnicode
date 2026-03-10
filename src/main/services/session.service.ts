import { v4 as uuid } from 'uuid';
import { getDatabase } from './database.service';
import type { Session, SessionMessage } from '../../shared/session-types';
import type { ProviderContent } from '../../shared/provider-types';

const DEFAULT_SESSION_TITLE = 'New Chat';
const MAX_TITLE_LENGTH = 72;

function deriveTitleFromContent(content: ProviderContent[]): string {
  const text = content
    .map((block) => {
      if (block.type === 'text') return block.text;
      if (block.type === 'code') return `${block.language} code`;
      return '';
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    return DEFAULT_SESSION_TITLE;
  }

  if (text.length <= MAX_TITLE_LENGTH) {
    return text;
  }

  return `${text.slice(0, MAX_TITLE_LENGTH).trimEnd()}...`;
}

export function createSession(projectId: string, provider = 'claude'): Session {
  const db = getDatabase();
  const id = uuid();
  const now = Date.now();

  db.prepare(
    'INSERT INTO sessions (id, project_id, title, provider, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, projectId, DEFAULT_SESSION_TITLE, provider, now, now);

  return {
    id,
    projectId,
    title: DEFAULT_SESSION_TITLE,
    provider,
    createdAt: now,
    updatedAt: now,
  };
}

export function listSessions(projectId: string): Session[] {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT * FROM sessions WHERE project_id = ? ORDER BY updated_at DESC'
  ).all(projectId) as any[];

  return rows.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    provider: r.provider,
    sdkSessionId: r.sdk_session_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function getSession(id: string): Session | null {
  const db = getDatabase();
  const r = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as any;
  if (!r) return null;

  return {
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    provider: r.provider,
    sdkSessionId: r.sdk_session_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function updateSession(id: string, updates: Partial<Pick<Session, 'title' | 'sdkSessionId'>>): void {
  const db = getDatabase();
  const now = Date.now();
  if (updates.title !== undefined) {
    db.prepare('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?').run(updates.title, now, id);
  }
  if (updates.sdkSessionId !== undefined) {
    db.prepare('UPDATE sessions SET sdk_session_id = ?, updated_at = ? WHERE id = ?').run(updates.sdkSessionId, now, id);
  }
}

export function deleteSession(id: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

export function addMessage(sessionId: string, role: string, content: ProviderContent[]): SessionMessage {
  const db = getDatabase();
  const id = uuid();
  const now = Date.now();
  const serialized = JSON.stringify(content);

  if (role === 'user') {
    const hasUserMessage = db.prepare(
      'SELECT 1 FROM session_messages WHERE session_id = ? AND role = ? LIMIT 1'
    ).get(sessionId, 'user');

    if (!hasUserMessage) {
      const title = deriveTitleFromContent(content);
      db.prepare(
        'UPDATE sessions SET title = ?, updated_at = ? WHERE id = ? AND title = ?'
      ).run(title, now, sessionId, DEFAULT_SESSION_TITLE);
    }
  }

  db.prepare(
    'INSERT INTO session_messages (id, session_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)'
  ).run(id, sessionId, role, serialized, now);

  db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);

  return { id, sessionId, role: role as any, content: serialized, timestamp: now };
}

export function getMessages(sessionId: string): SessionMessage[] {
  const db = getDatabase();
  return db.prepare(
    'SELECT * FROM session_messages WHERE session_id = ? ORDER BY timestamp ASC'
  ).all(sessionId) as any[];
}
