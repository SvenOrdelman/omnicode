import { v4 as uuid } from 'uuid';
import { getDatabase } from './database.service';
import type { Session, SessionMessage } from '../../shared/session-types';
import type { ChatRequestOptions } from '../../shared/chat-types';
import type { ProviderContent } from '../../shared/provider-types';
import {
  normalizeAgentMode,
  normalizeChatExecutionMode,
  normalizeChatModelId,
} from '../../shared/chat-types';

const DEFAULT_SESSION_TITLE = 'New Chat';
const MAX_TITLE_LENGTH = 72;

function mapRowToSession(row: any): Session {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    provider: row.provider,
    sdkSessionId: row.sdk_session_id,
    model: normalizeChatModelId(row.model),
    agentMode: normalizeAgentMode(row.agent_mode),
    executionMode: normalizeChatExecutionMode(row.execution_mode),
    archived: Boolean(row.archived),
    archivedAt: row.archived_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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

export function createSession(projectId: string, provider = 'claude', chatOptions?: ChatRequestOptions): Session {
  const db = getDatabase();
  const id = uuid();
  const now = Date.now();
  const model = normalizeChatModelId(chatOptions?.model);
  const agentMode = normalizeAgentMode(chatOptions?.mode);
  const executionMode = normalizeChatExecutionMode(chatOptions?.executionMode);

  db.prepare(
    'INSERT INTO sessions (id, project_id, title, provider, model, agent_mode, execution_mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, projectId, DEFAULT_SESSION_TITLE, provider, model, agentMode, executionMode, now, now);

  return {
    id,
    projectId,
    title: DEFAULT_SESSION_TITLE,
    provider,
    model,
    agentMode,
    executionMode,
    archived: false,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function listSessions(projectId: string, includeArchived = false): Session[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT * FROM sessions
       WHERE project_id = ?
       ${includeArchived ? '' : 'AND archived = 0'}
       ORDER BY updated_at DESC`
    )
    .all(projectId) as any[];

  return rows.map((row) => mapRowToSession(row));
}

export function getSession(id: string): Session | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as any;
  if (!row) return null;
  return mapRowToSession(row);
}

export function updateSession(
  id: string,
  updates: Partial<Pick<Session, 'title' | 'sdkSessionId' | 'model' | 'agentMode' | 'executionMode'>>
): void {
  const db = getDatabase();
  const now = Date.now();
  if (updates.title !== undefined) {
    db.prepare('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?').run(updates.title, now, id);
  }
  if (updates.sdkSessionId !== undefined) {
    db.prepare('UPDATE sessions SET sdk_session_id = ?, updated_at = ? WHERE id = ?').run(updates.sdkSessionId, now, id);
  }
  if (updates.model !== undefined) {
    db.prepare('UPDATE sessions SET model = ?, updated_at = ? WHERE id = ?').run(
      normalizeChatModelId(updates.model),
      now,
      id
    );
  }
  if (updates.agentMode !== undefined) {
    db.prepare('UPDATE sessions SET agent_mode = ?, updated_at = ? WHERE id = ?').run(
      normalizeAgentMode(updates.agentMode),
      now,
      id
    );
  }
  if (updates.executionMode !== undefined) {
    db.prepare('UPDATE sessions SET execution_mode = ?, updated_at = ? WHERE id = ?').run(
      normalizeChatExecutionMode(updates.executionMode),
      now,
      id
    );
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

  // A new message automatically unarchives the session.
  db.prepare('UPDATE sessions SET archived = 0, archived_at = NULL WHERE id = ?').run(sessionId);

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

export function setSessionArchived(id: string, archived: boolean): void {
  const db = getDatabase();
  const now = Date.now();
  db.prepare('UPDATE sessions SET archived = ?, archived_at = ?, updated_at = ? WHERE id = ?').run(
    archived ? 1 : 0,
    archived ? now : null,
    now,
    id
  );
}

export function getMessages(sessionId: string): SessionMessage[] {
  const db = getDatabase();
  return db.prepare(
    'SELECT * FROM session_messages WHERE session_id = ? ORDER BY timestamp ASC'
  ).all(sessionId) as any[];
}
