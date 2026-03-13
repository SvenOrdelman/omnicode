import Database from 'better-sqlite3';
import path from 'node:path';
import { app } from 'electron';
import { DEFAULT_CHAT_EXECUTION_MODE, DEFAULT_CHAT_MODEL } from '../../shared/chat-types';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (db) return db;

  const dbPath = path.join(app.getPath('userData'), 'omnicode.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema(db);
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      last_opened INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'New Chat',
      provider TEXT NOT NULL DEFAULT 'claude',
      sdk_session_id TEXT,
      model TEXT NOT NULL DEFAULT '${DEFAULT_CHAT_MODEL}',
      agent_mode TEXT NOT NULL DEFAULT 'code',
      execution_mode TEXT NOT NULL DEFAULT '${DEFAULT_CHAT_EXECUTION_MODE}',
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS session_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const sessionColumns = db.prepare('PRAGMA table_info(sessions)').all() as Array<{ name: string }>;
  const hasArchived = sessionColumns.some((column) => column.name === 'archived');
  const hasArchivedAt = sessionColumns.some((column) => column.name === 'archived_at');
  const hasModel = sessionColumns.some((column) => column.name === 'model');
  const hasAgentMode = sessionColumns.some((column) => column.name === 'agent_mode');
  const hasExecutionMode = sessionColumns.some((column) => column.name === 'execution_mode');

  if (!hasArchived) {
    db.exec('ALTER TABLE sessions ADD COLUMN archived INTEGER NOT NULL DEFAULT 0');
  }

  if (!hasArchivedAt) {
    db.exec('ALTER TABLE sessions ADD COLUMN archived_at INTEGER');
  }

  if (!hasModel) {
    db.exec(`ALTER TABLE sessions ADD COLUMN model TEXT NOT NULL DEFAULT '${DEFAULT_CHAT_MODEL}'`);
  }

  if (!hasAgentMode) {
    db.exec("ALTER TABLE sessions ADD COLUMN agent_mode TEXT NOT NULL DEFAULT 'code'");
  }

  if (!hasExecutionMode) {
    db.exec(
      `ALTER TABLE sessions ADD COLUMN execution_mode TEXT NOT NULL DEFAULT '${DEFAULT_CHAT_EXECUTION_MODE}'`
    );
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
