import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface Topic {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  summary: string | null;
  key_insights: string | null;
}

export interface Message {
  id: string;
  topic_id: string;
  role: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  is_deleted: number;
}

export interface PersonalityTrait {
  id: string;
  category: string;
  key: string;
  value: string;
  confidence: number;
  evidence: string;
  updated_at: string;
}

export interface Connection {
  id: string;
  topic_a_id: string;
  topic_b_id: string;
  relationship: string;
  created_at: string;
}

// ── Schema (inlined for reliable resolution across module systems) ───────────

const SCHEMA = `
CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  summary TEXT,
  key_insights TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES topics(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  edited_at TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS personality (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.1,
  evidence TEXT DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS connections (
  id TEXT PRIMARY KEY,
  topic_a_id TEXT NOT NULL REFERENCES topics(id),
  topic_b_id TEXT NOT NULL REFERENCES topics(id),
  relationship TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_topic ON messages(topic_id);
CREATE INDEX IF NOT EXISTS idx_personality_category ON personality(category);
CREATE INDEX IF NOT EXISTS idx_connections_topics ON connections(topic_a_id, topic_b_id);
`;

// ── SophonDB ────────────────────────────────────────────────────────────────

export class SophonDB {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Ensure parent directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);

    // Performance and integrity pragmas
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    // Initialize schema
    this.db.exec(SCHEMA);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  close(): void {
    this.db.close();
  }

  // ── Introspection ───────────────────────────────────────────────────────

  listTables(): string[] {
    const rows = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];
    return rows.map((r) => r.name);
  }

  // ── Topics ──────────────────────────────────────────────────────────────

  createTopic(title: string): Topic {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db
      .prepare(
        'INSERT INTO topics (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(id, title, 'active', now, now);
    return this.getTopic(id)!;
  }

  getTopic(id: string): Topic | undefined {
    return this.db.prepare('SELECT * FROM topics WHERE id = ?').get(id) as Topic | undefined;
  }

  getTopicsByStatus(status: string): Topic[] {
    return this.db.prepare('SELECT * FROM topics WHERE status = ? ORDER BY updated_at DESC').all(status) as Topic[];
  }

  getActiveTopic(): Topic | undefined {
    return this.db
      .prepare("SELECT * FROM topics WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1")
      .get() as Topic | undefined;
  }

  archiveTopic(id: string, summary?: string, keyInsights?: string[]): void {
    const insightsJson = keyInsights ? JSON.stringify(keyInsights) : null;
    this.db
      .prepare(
        "UPDATE topics SET status = 'archived', summary = ?, key_insights = ?, updated_at = ? WHERE id = ?"
      )
      .run(summary ?? null, insightsJson, new Date().toISOString(), id);
  }

  updateTopicTimestamp(id: string): void {
    this.db
      .prepare('UPDATE topics SET updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), id);
  }

  // ── Messages ────────────────────────────────────────────────────────────

  addMessage(topicId: string, role: string, content: string): Message {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db
      .prepare(
        'INSERT INTO messages (id, topic_id, role, content, created_at, is_deleted) VALUES (?, ?, ?, ?, ?, 0)'
      )
      .run(id, topicId, role, content, now);

    // Also bump the topic's updated_at
    this.updateTopicTimestamp(topicId);

    return this.getMessage(id)!;
  }

  getMessage(id: string): Message | undefined {
    return this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Message | undefined;
  }

  getTopicMessages(topicId: string): Message[] {
    return this.db
      .prepare(
        'SELECT * FROM messages WHERE topic_id = ? AND is_deleted = 0 ORDER BY created_at ASC'
      )
      .all(topicId) as Message[];
  }

  editMessage(id: string, newContent: string): void {
    this.db
      .prepare('UPDATE messages SET content = ?, edited_at = ? WHERE id = ?')
      .run(newContent, new Date().toISOString(), id);
  }

  deleteMessage(id: string): void {
    this.db.prepare('UPDATE messages SET is_deleted = 1 WHERE id = ?').run(id);
  }

  // ── Personality Traits ──────────────────────────────────────────────────

  upsertTrait(
    category: string,
    key: string,
    value: string,
    confidence: number,
    evidenceMessageIds: string[]
  ): PersonalityTrait {
    const now = new Date().toISOString();
    const evidenceJson = JSON.stringify(evidenceMessageIds);

    // Check if a trait with this category+key already exists
    const existing = this.db
      .prepare('SELECT * FROM personality WHERE category = ? AND key = ?')
      .get(category, key) as PersonalityTrait | undefined;

    if (existing) {
      // Merge evidence arrays
      const existingEvidence: string[] = JSON.parse(existing.evidence || '[]');
      const merged = [...new Set([...existingEvidence, ...evidenceMessageIds])];
      this.db
        .prepare(
          'UPDATE personality SET value = ?, confidence = ?, evidence = ?, updated_at = ? WHERE id = ?'
        )
        .run(value, confidence, JSON.stringify(merged), now, existing.id);
      return this.getTraitById(existing.id)!;
    } else {
      const id = uuidv4();
      this.db
        .prepare(
          'INSERT INTO personality (id, category, key, value, confidence, evidence, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run(id, category, key, value, confidence, evidenceJson, now);
      return this.getTraitById(id)!;
    }
  }

  getTraitById(id: string): PersonalityTrait | undefined {
    return this.db.prepare('SELECT * FROM personality WHERE id = ?').get(id) as
      | PersonalityTrait
      | undefined;
  }

  getTraitsByCategory(category: string): PersonalityTrait[] {
    return this.db
      .prepare('SELECT * FROM personality WHERE category = ? ORDER BY confidence DESC')
      .all(category) as PersonalityTrait[];
  }

  getAllTraits(): PersonalityTrait[] {
    return this.db
      .prepare('SELECT * FROM personality ORDER BY category, confidence DESC')
      .all() as PersonalityTrait[];
  }

  deleteTrait(id: string): void {
    this.db.prepare('DELETE FROM personality WHERE id = ?').run(id);
  }

  // ── Connections ─────────────────────────────────────────────────────────

  addConnection(topicAId: string, topicBId: string, relationship: string): Connection {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db
      .prepare(
        'INSERT INTO connections (id, topic_a_id, topic_b_id, relationship, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(id, topicAId, topicBId, relationship, now);
    return this.db.prepare('SELECT * FROM connections WHERE id = ?').get(id) as Connection;
  }

  getConnectionsForTopic(topicId: string): Connection[] {
    return this.db
      .prepare(
        'SELECT * FROM connections WHERE topic_a_id = ? OR topic_b_id = ? ORDER BY created_at DESC'
      )
      .all(topicId, topicId) as Connection[];
  }

  // ── Stats ───────────────────────────────────────────────────────────────

  getMessageCount(): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM messages WHERE is_deleted = 0')
      .get() as { count: number };
    return row.count;
  }

  getTopicCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM topics').get() as {
      count: number;
    };
    return row.count;
  }
}
