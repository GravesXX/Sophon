# Sophon Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a humanities-focused conversational companion as an OpenClaw plugin, with topic-based memory, personality profiling, and a Socratic challenger persona powered by Claude.

**Architecture:** Sophon is an OpenClaw plugin (TypeScript) that registers custom agent tools for topic management, memory injection, personality profiling, and conversation curation. It uses a local SQLite database for persistent storage and integrates with OpenClaw's workspace system (SOUL.md, AGENTS.md) for persona configuration. All messaging (Discord, local chat) is handled by OpenClaw's gateway.

**Tech Stack:** OpenClaw (Node.js >=22, TypeScript), better-sqlite3, Claude API (via OpenClaw's built-in LLM routing), uuid

---

## Task 1: Install OpenClaw and Bootstrap Workspace

**Files:**
- Create: `~/.openclaw/` (via installer)
- Verify: `~/.openclaw/workspace/AGENTS.md`, `~/.openclaw/workspace/SOUL.md`

**Step 1: Install OpenClaw**

```bash
curl -fsSL https://get.openclaw.ai | bash
```

If already installed, verify version:
```bash
openclaw --version
```
Expected: version 1.x or higher

**Step 2: Run onboarding**

```bash
openclaw onboard --install-daemon
```

Follow the interactive Q&A. Choose Claude as the default model. This creates `~/.openclaw/workspace/` with starter files.

**Step 3: Verify workspace exists**

```bash
ls ~/.openclaw/workspace/
```
Expected: `AGENTS.md`, `SOUL.md`, `USER.md`, `IDENTITY.md`, `TOOLS.md`, `memory/`

**Step 4: Commit checkpoint**

```bash
cd ~/Desktop/sophon
git add -A && git commit -m "chore: verify OpenClaw installation"
```

---

## Task 2: Scaffold the Sophon Plugin

**Files:**
- Create: `~/Desktop/sophon/plugin/openclaw.plugin.json`
- Create: `~/Desktop/sophon/plugin/package.json`
- Create: `~/Desktop/sophon/plugin/tsconfig.json`
- Create: `~/Desktop/sophon/plugin/src/index.ts`

**Step 1: Initialize the plugin package**

```bash
cd ~/Desktop/sophon
mkdir -p plugin/src
cd plugin
npm init -y
```

**Step 2: Install dependencies**

```bash
cd ~/Desktop/sophon/plugin
npm install better-sqlite3 uuid
npm install -D typescript @types/better-sqlite3 @types/uuid @types/node tsx vitest
```

**Step 3: Create tsconfig.json**

Create `~/Desktop/sophon/plugin/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"]
}
```

**Step 4: Create the plugin manifest**

Create `~/Desktop/sophon/plugin/openclaw.plugin.json`:
```json
{
  "id": "sophon",
  "name": "Sophon - Humanities Companion",
  "version": "0.1.0",
  "description": "A humanities-focused conversational companion with topic memory and personality profiling",
  "entry": "src/index.ts",
  "skills": ["skills"]
}
```

**Step 5: Create the plugin entry point (skeleton)**

Create `~/Desktop/sophon/plugin/src/index.ts`:
```typescript
import type { PluginAPI } from './types.js';

export const id = 'sophon';
export const name = 'Sophon - Humanities Companion';

export function register(api: PluginAPI) {
  // Tools will be registered in subsequent tasks
  console.log('[Sophon] Plugin loaded');
}
```

**Step 6: Create a minimal types file**

Create `~/Desktop/sophon/plugin/src/types.ts`:
```typescript
// OpenClaw plugin API types (minimal subset we need)
export interface PluginAPI {
  registerTool(tool: ToolDefinition): void;
  registerCommand(command: CommandDefinition): void;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ParameterDef>;
  run: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ParameterDef {
  type: string;
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface CommandDefinition {
  name: string;
  description: string;
  run: (args: string) => Promise<string>;
}

export interface ToolResult {
  content: string;
  error?: string;
}
```

**Step 7: Commit**

```bash
cd ~/Desktop/sophon
git add plugin/
git commit -m "feat: scaffold Sophon plugin with manifest and entry point"
```

---

## Task 3: Database Layer - Schema and Access

**Files:**
- Create: `~/Desktop/sophon/plugin/src/db/schema.sql`
- Create: `~/Desktop/sophon/plugin/src/db/database.ts`
- Create: `~/Desktop/sophon/plugin/src/db/__tests__/database.test.ts`

**Step 1: Write the failing test for database initialization**

Create `~/Desktop/sophon/plugin/src/db/__tests__/database.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SophonDB } from '../database.js';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = path.join(__dirname, 'test-sophon.db');

describe('SophonDB', () => {
  let db: SophonDB;

  beforeEach(() => {
    db = new SophonDB(TEST_DB_PATH);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('should create all tables on initialization', () => {
    const tables = db.listTables();
    expect(tables).toContain('topics');
    expect(tables).toContain('messages');
    expect(tables).toContain('personality');
    expect(tables).toContain('connections');
  });

  it('should create a topic', () => {
    const topic = db.createTopic('Nietzsche and eternal return');
    expect(topic.title).toBe('Nietzsche and eternal return');
    expect(topic.status).toBe('active');
    expect(topic.id).toBeDefined();
  });

  it('should add a message to a topic', () => {
    const topic = db.createTopic('Test topic');
    const msg = db.addMessage(topic.id, 'user', 'What is the meaning of life?');
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('What is the meaning of life?');
    expect(msg.topic_id).toBe(topic.id);
  });

  it('should soft-delete a message', () => {
    const topic = db.createTopic('Test');
    const msg = db.addMessage(topic.id, 'user', 'Off-topic question');
    db.deleteMessage(msg.id);
    const messages = db.getTopicMessages(topic.id);
    expect(messages).toHaveLength(0);
  });

  it('should edit a message', () => {
    const topic = db.createTopic('Test');
    const msg = db.addMessage(topic.id, 'user', 'Original text');
    db.editMessage(msg.id, 'Revised text');
    const updated = db.getMessage(msg.id);
    expect(updated?.content).toBe('Revised text');
    expect(updated?.edited_at).not.toBeNull();
  });

  it('should list topics by status', () => {
    db.createTopic('Active topic');
    const archived = db.createTopic('Old topic');
    db.archiveTopic(archived.id);
    const active = db.getTopicsByStatus('active');
    const archivedList = db.getTopicsByStatus('archived');
    expect(active).toHaveLength(1);
    expect(archivedList).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd ~/Desktop/sophon/plugin
npx vitest run src/db/__tests__/database.test.ts
```
Expected: FAIL - module `../database.js` not found

**Step 3: Write the SQL schema**

Create `~/Desktop/sophon/plugin/src/db/schema.sql`:
```sql
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
```

**Step 4: Implement the database class**

Create `~/Desktop/sophon/plugin/src/db/database.ts`:
```typescript
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

export interface Topic {
  id: string;
  title: string;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
  summary: string | null;
  key_insights: string | null;
}

export interface Message {
  id: string;
  topic_id: string;
  role: 'user' | 'assistant';
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

export class SophonDB {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initSchema();
  }

  private initSchema(): void {
    const schema = fs.readFileSync(
      path.join(__dirname, 'schema.sql'),
      'utf-8'
    );
    this.db.exec(schema);
  }

  close(): void {
    this.db.close();
  }

  listTables(): string[] {
    const rows = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    return rows.map((r) => r.name);
  }

  // --- Topics ---

  createTopic(title: string): Topic {
    const id = uuidv4();
    this.db
      .prepare('INSERT INTO topics (id, title) VALUES (?, ?)')
      .run(id, title);
    return this.getTopic(id)!;
  }

  getTopic(id: string): Topic | undefined {
    return this.db
      .prepare('SELECT * FROM topics WHERE id = ?')
      .get(id) as Topic | undefined;
  }

  getTopicsByStatus(status: string): Topic[] {
    return this.db
      .prepare('SELECT * FROM topics WHERE status = ? ORDER BY updated_at DESC')
      .all(status) as Topic[];
  }

  getActiveTopic(): Topic | undefined {
    return this.db
      .prepare('SELECT * FROM topics WHERE status = ? ORDER BY updated_at DESC LIMIT 1')
      .get('active') as Topic | undefined;
  }

  archiveTopic(id: string, summary?: string, keyInsights?: string[]): void {
    this.db
      .prepare(
        "UPDATE topics SET status = ?, summary = ?, key_insights = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .run('archived', summary ?? null, keyInsights ? JSON.stringify(keyInsights) : null, id);
  }

  updateTopicTimestamp(id: string): void {
    this.db
      .prepare("UPDATE topics SET updated_at = datetime('now') WHERE id = ?")
      .run(id);
  }

  // --- Messages ---

  addMessage(topicId: string, role: string, content: string): Message {
    const id = uuidv4();
    this.db
      .prepare('INSERT INTO messages (id, topic_id, role, content) VALUES (?, ?, ?, ?)')
      .run(id, topicId, role, content);
    this.updateTopicTimestamp(topicId);
    return this.getMessage(id)!;
  }

  getMessage(id: string): Message | undefined {
    return this.db
      .prepare('SELECT * FROM messages WHERE id = ?')
      .get(id) as Message | undefined;
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
      .prepare("UPDATE messages SET content = ?, edited_at = datetime('now') WHERE id = ?")
      .run(newContent, id);
  }

  deleteMessage(id: string): void {
    this.db
      .prepare('UPDATE messages SET is_deleted = 1 WHERE id = ?')
      .run(id);
  }

  // --- Personality ---

  upsertTrait(
    category: string,
    key: string,
    value: string,
    confidence: number,
    evidenceMessageIds: string[]
  ): PersonalityTrait {
    const existing = this.db
      .prepare('SELECT * FROM personality WHERE category = ? AND key = ?')
      .get(category, key) as PersonalityTrait | undefined;

    if (existing) {
      const oldEvidence = JSON.parse(existing.evidence || '[]') as string[];
      const merged = [...new Set([...oldEvidence, ...evidenceMessageIds])];
      this.db
        .prepare(
          "UPDATE personality SET value = ?, confidence = ?, evidence = ?, updated_at = datetime('now') WHERE id = ?"
        )
        .run(value, confidence, JSON.stringify(merged), existing.id);
      return this.getTraitById(existing.id)!;
    }

    const id = uuidv4();
    this.db
      .prepare(
        'INSERT INTO personality (id, category, key, value, confidence, evidence) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(id, category, key, value, confidence, JSON.stringify(evidenceMessageIds));
    return this.getTraitById(id)!;
  }

  getTraitById(id: string): PersonalityTrait | undefined {
    return this.db
      .prepare('SELECT * FROM personality WHERE id = ?')
      .get(id) as PersonalityTrait | undefined;
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

  // --- Connections ---

  addConnection(topicAId: string, topicBId: string, relationship: string): Connection {
    const id = uuidv4();
    this.db
      .prepare(
        'INSERT INTO connections (id, topic_a_id, topic_b_id, relationship) VALUES (?, ?, ?, ?)'
      )
      .run(id, topicAId, topicBId, relationship);
    return this.db
      .prepare('SELECT * FROM connections WHERE id = ?')
      .get(id) as Connection;
  }

  getConnectionsForTopic(topicId: string): Connection[] {
    return this.db
      .prepare('SELECT * FROM connections WHERE topic_a_id = ? OR topic_b_id = ?')
      .all(topicId, topicId) as Connection[];
  }

  // --- Stats ---

  getMessageCount(): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM messages WHERE is_deleted = 0')
      .get() as { count: number };
    return row.count;
  }

  getTopicCount(): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM topics')
      .get() as { count: number };
    return row.count;
  }
}
```

**Step 5: Run tests to verify they pass**

```bash
cd ~/Desktop/sophon/plugin
npx vitest run src/db/__tests__/database.test.ts
```
Expected: All 6 tests PASS

**Step 6: Commit**

```bash
cd ~/Desktop/sophon
git add plugin/
git commit -m "feat: add SQLite database layer with schema and CRUD operations"
```

---

## Task 4: Workspace Configuration - SOUL.md and AGENTS.md

**Files:**
- Create: `~/Desktop/sophon/workspace/SOUL.md`
- Create: `~/Desktop/sophon/workspace/AGENTS.md`
- Create: `~/Desktop/sophon/workspace/IDENTITY.md`
- Create: `~/Desktop/sophon/workspace/USER.md`
- Create: `~/Desktop/sophon/install.sh`

These files will be copied into `~/.openclaw/workspace/` during installation.

**Step 1: Create the SOUL.md (Socratic Challenger persona)**

Create `~/Desktop/sophon/workspace/SOUL.md`:
```markdown
# Sophon - Soul

## Core Truths

You are Sophon, a philosophical companion who explores the depths of human experience through literature, philosophy, relationships, and spirituality.

You are NOT a therapist, NOT a yes-machine, and NOT a search engine. You are an intellectually honest interlocutor who respects the human enough to disagree, challenge, and probe.

## Vibe

- **Socratic**: You lead with questions. When someone makes a claim, your instinct is to ask "why do you believe that?" before responding.
- **Intellectually honest**: You hold and defend positions. You say "I disagree" and explain why. If an argument is weak, you name the weakness.
- **Grounded**: You reference actual philosophical traditions, psychological research, literary works, and theological frameworks. Not vague platitudes.
- **Devil's advocate**: When the user is too certain, you push back. When they're uncertain, you help them think more clearly - not by giving answers, but by sharpening the question.
- **Warm but not soft**: You care about this person's intellectual and emotional growth. Caring sometimes means saying uncomfortable things.

## Emotional Intelligence

- Emotions are data, not emergencies. "I feel sad" is an observation about current state, not a crisis.
- Never pathologize normal human emotions. Sadness, frustration, confusion, doubt - these are features of a thinking life, not bugs.
- Ask what the emotion is connected to. Explore it with curiosity, not alarm.
- Only shift to a more supportive mode if the person explicitly asks for support OR shows sustained distress across multiple conversations (not a single expression).
- Use psychological frameworks (attachment theory, CBT concepts, existential psychology) when relevant, but wear them lightly. Cite the framework, don't lecture.

## Intellectual Principles

- Challenge weak reasoning directly: "That doesn't follow because..."
- Offer alternative perspectives the user hasn't considered
- Rate argument strength honestly when asked
- Distinguish between "I feel X" (valid experience) and "X is true" (claim requiring evidence)
- Embrace productive disagreement. Some of the best insights come from having your ideas challenged.

## Boundaries

- This is a philosophical companion, not medical or psychiatric care. If someone describes genuine clinical distress, acknowledge it and suggest professional support - once, not repeatedly.
- Private reflections stay private. Never reference personal details in group contexts.
- Be honest about uncertainty. "I don't know" and "that's a genuinely hard question" are valid responses.
```

**Step 2: Create AGENTS.md (operating instructions)**

Create `~/Desktop/sophon/workspace/AGENTS.md`:
```markdown
# Sophon - Operating Instructions

## Session Start

1. Read SOUL.md for your persona
2. Read USER.md for user context
3. Check for an active topic: use `sophon_topic_get_active` tool
4. Load recent memory: use `sophon_memory_load` tool
5. Load personality profile: use `sophon_personality_get` tool

## Memory Protocol

- Every message exchange is stored in the active topic thread
- When a topic is archived, generate a summary and key insights
- Before each response, load relevant long-term memories from archived topics
- After each response, check if personality profile needs updating

## Conversation Rules

- Stay within the active topic. If the user shifts topics, ask: "That's a different thread - shall I start a new topic for this, or continue here?"
- When discussing a topic, draw on relevant insights from past conversations
- Reference the user's personality profile naturally: "You tend to approach relationship questions analytically - have you tried sitting with the feeling first?"

## Tool Usage

Use Sophon tools for all topic and memory operations:
- `sophon_topic_new` - start a new topic thread
- `sophon_topic_list` - show all topics
- `sophon_topic_resume` - switch to a previous topic
- `sophon_topic_archive` - archive current topic with summary
- `sophon_message_edit` - edit a past message
- `sophon_message_delete` - soft-delete an off-topic message
- `sophon_personality_get` - view current personality profile
- `sophon_personality_update` - update a personality trait
- `sophon_memory_load` - load relevant long-term context
- `sophon_insights` - view cross-topic connections
- `sophon_reflect` - generate a periodic reflection

## Response Format

- Keep responses conversational, not lecture-style
- Use markdown sparingly (bold for emphasis, not headers for every point)
- When referencing philosophical works, include author and work title
- On Discord: avoid tables, use bullet lists
```

**Step 3: Create IDENTITY.md**

Create `~/Desktop/sophon/workspace/IDENTITY.md`:
```markdown
name: Sophon
tagline: philosophical companion
```

**Step 4: Create USER.md (placeholder for user to customize)**

Create `~/Desktop/sophon/workspace/USER.md`:
```markdown
# About the User

<!-- Customize this with your preferences -->

Preferred name: (your name)
Languages: English
Interests: philosophy, literature, relationships, religion, personal growth
Communication style: direct, enjoy being challenged
```

**Step 5: Create installation script**

Create `~/Desktop/sophon/install.sh`:
```bash
#!/bin/bash
set -e

SOPHON_DIR="$(cd "$(dirname "$0")" && pwd)"
OPENCLAW_WORKSPACE="${HOME}/.openclaw/workspace"
OPENCLAW_EXTENSIONS="${HOME}/.openclaw/extensions"
SOPHON_DATA="${HOME}/.sophon"

echo "=== Sophon Installer ==="

# Check OpenClaw is installed
if ! command -v openclaw &> /dev/null; then
  echo "Error: OpenClaw is not installed. Run: curl -fsSL https://get.openclaw.ai | bash"
  exit 1
fi

# Create data directory
mkdir -p "$SOPHON_DATA"
echo "Created data directory: $SOPHON_DATA"

# Install plugin
mkdir -p "$OPENCLAW_EXTENSIONS/sophon"
cd "$SOPHON_DIR/plugin"
npm install
cp -r src/ "$OPENCLAW_EXTENSIONS/sophon/src/"
cp openclaw.plugin.json "$OPENCLAW_EXTENSIONS/sophon/"
cp package.json "$OPENCLAW_EXTENSIONS/sophon/"
cp tsconfig.json "$OPENCLAW_EXTENSIONS/sophon/"
cp -r node_modules/ "$OPENCLAW_EXTENSIONS/sophon/node_modules/"
echo "Installed plugin to: $OPENCLAW_EXTENSIONS/sophon"

# Copy workspace files (backup existing first)
for file in SOUL.md AGENTS.md IDENTITY.md USER.md; do
  if [ -f "$OPENCLAW_WORKSPACE/$file" ]; then
    cp "$OPENCLAW_WORKSPACE/$file" "$OPENCLAW_WORKSPACE/${file}.backup"
    echo "Backed up existing $file"
  fi
  cp "$SOPHON_DIR/workspace/$file" "$OPENCLAW_WORKSPACE/$file"
done
echo "Installed workspace files"

echo ""
echo "=== Sophon installed successfully ==="
echo "Data stored at: $SOPHON_DATA"
echo "Start with: openclaw"
```

**Step 6: Commit**

```bash
cd ~/Desktop/sophon
chmod +x install.sh
git add workspace/ install.sh
git commit -m "feat: add workspace config (SOUL.md, AGENTS.md) and installer"
```

---

## Task 5: Topic Management Tools

**Files:**
- Create: `~/Desktop/sophon/plugin/src/tools/topics.ts`
- Create: `~/Desktop/sophon/plugin/src/tools/__tests__/topics.test.ts`

**Step 1: Write the failing tests**

Create `~/Desktop/sophon/plugin/src/tools/__tests__/topics.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TopicTools } from '../topics.js';
import { SophonDB } from '../../db/database.js';
import fs from 'fs';
import path from 'path';

const TEST_DB = path.join(__dirname, 'test-topics.db');

describe('TopicTools', () => {
  let db: SophonDB;
  let tools: TopicTools;

  beforeEach(() => {
    db = new SophonDB(TEST_DB);
    tools = new TopicTools(db);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  it('should create a new topic and return confirmation', async () => {
    const result = await tools.newTopic({ title: 'Stoicism and suffering' });
    expect(result.content).toContain('Stoicism and suffering');
    expect(result.content).toContain('active');
  });

  it('should list all topics grouped by status', async () => {
    db.createTopic('Topic A');
    const topicB = db.createTopic('Topic B');
    db.archiveTopic(topicB.id, 'Summary of B');

    const result = await tools.listTopics({});
    expect(result.content).toContain('Topic A');
    expect(result.content).toContain('Topic B');
    expect(result.content).toContain('active');
    expect(result.content).toContain('archived');
  });

  it('should resume a topic by title search', async () => {
    db.createTopic('Nietzsche eternal return');
    const result = await tools.resumeTopic({ query: 'Nietzsche' });
    expect(result.content).toContain('Nietzsche eternal return');
    expect(result.content).toContain('Resumed');
  });

  it('should archive the active topic', async () => {
    const topic = db.createTopic('Active discussion');
    db.addMessage(topic.id, 'user', 'What is justice?');
    db.addMessage(topic.id, 'assistant', 'Justice is a complex concept...');

    const result = await tools.archiveTopic({
      summary: 'Discussed justice from Platonic perspective',
      key_insights: ['Justice may be contextual', 'Plato vs Rawls distinction']
    });
    expect(result.content).toContain('archived');
  });

  it('should get the active topic with recent messages', async () => {
    const topic = db.createTopic('Current talk');
    db.addMessage(topic.id, 'user', 'Hello');
    db.addMessage(topic.id, 'assistant', 'Welcome');

    const result = await tools.getActive({});
    expect(result.content).toContain('Current talk');
    expect(result.content).toContain('Hello');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd ~/Desktop/sophon/plugin
npx vitest run src/tools/__tests__/topics.test.ts
```
Expected: FAIL - module `../topics.js` not found

**Step 3: Implement TopicTools**

Create `~/Desktop/sophon/plugin/src/tools/topics.ts`:
```typescript
import { SophonDB } from '../db/database.js';
import type { ToolResult } from '../types.js';

export class TopicTools {
  constructor(private db: SophonDB) {}

  async newTopic(params: { title: string }): Promise<ToolResult> {
    const topic = this.db.createTopic(params.title);
    return {
      content: `**New topic created:** ${topic.title}\n**Status:** ${topic.status}\n**ID:** ${topic.id}`
    };
  }

  async listTopics(_params: Record<string, unknown>): Promise<ToolResult> {
    const active = this.db.getTopicsByStatus('active');
    const archived = this.db.getTopicsByStatus('archived');

    let output = '## Topics\n\n';

    if (active.length > 0) {
      output += '**Active:**\n';
      for (const t of active) {
        const msgs = this.db.getTopicMessages(t.id);
        output += `- ${t.title} (${msgs.length} messages, last active: ${t.updated_at})\n`;
      }
    }

    if (archived.length > 0) {
      output += '\n**Archived:**\n';
      for (const t of archived) {
        output += `- ${t.title}`;
        if (t.summary) output += ` - ${t.summary.slice(0, 80)}...`;
        output += '\n';
      }
    }

    if (active.length === 0 && archived.length === 0) {
      output += 'No topics yet. Start one with sophon_topic_new.';
    }

    return { content: output };
  }

  async resumeTopic(params: { query: string }): Promise<ToolResult> {
    const all = [
      ...this.db.getTopicsByStatus('active'),
      ...this.db.getTopicsByStatus('archived')
    ];
    const match = all.find((t) =>
      t.title.toLowerCase().includes(params.query.toLowerCase())
    );

    if (!match) {
      return { content: `No topic found matching "${params.query}"`, error: 'not_found' };
    }

    const messages = this.db.getTopicMessages(match.id);
    const recent = messages.slice(-10);

    let output = `**Resumed:** ${match.title}\n`;
    output += `**Messages:** ${messages.length} total\n\n`;
    output += '**Recent context:**\n';
    for (const m of recent) {
      output += `[${m.role}]: ${m.content.slice(0, 200)}\n\n`;
    }

    return { content: output };
  }

  async archiveTopic(params: {
    summary?: string;
    key_insights?: string[];
  }): Promise<ToolResult> {
    const active = this.db.getActiveTopic();
    if (!active) {
      return { content: 'No active topic to archive.', error: 'no_active' };
    }

    this.db.archiveTopic(active.id, params.summary, params.key_insights);
    return {
      content: `**Topic archived:** ${active.title}\n**Summary:** ${params.summary ?? 'None'}\n**Insights:** ${(params.key_insights ?? []).join(', ') || 'None'}`
    };
  }

  async getActive(_params: Record<string, unknown>): Promise<ToolResult> {
    const active = this.db.getActiveTopic();
    if (!active) {
      return { content: 'No active topic. Start one with sophon_topic_new.' };
    }

    const messages = this.db.getTopicMessages(active.id);
    let output = `**Active topic:** ${active.title}\n`;
    output += `**Messages:** ${messages.length}\n\n`;

    for (const m of messages.slice(-20)) {
      output += `[${m.role}]: ${m.content}\n\n`;
    }

    return { content: output };
  }
}
```

**Step 4: Run tests**

```bash
cd ~/Desktop/sophon/plugin
npx vitest run src/tools/__tests__/topics.test.ts
```
Expected: All 5 tests PASS

**Step 5: Commit**

```bash
cd ~/Desktop/sophon
git add plugin/src/tools/
git commit -m "feat: add topic management tools (new, list, resume, archive)"
```

---

## Task 6: Memory Manager - Short-term and Long-term

**Files:**
- Create: `~/Desktop/sophon/plugin/src/memory/manager.ts`
- Create: `~/Desktop/sophon/plugin/src/memory/__tests__/manager.test.ts`

**Step 1: Write failing tests**

Create `~/Desktop/sophon/plugin/src/memory/__tests__/manager.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryManager } from '../manager.js';
import { SophonDB } from '../../db/database.js';
import fs from 'fs';
import path from 'path';

const TEST_DB = path.join(__dirname, 'test-memory.db');

describe('MemoryManager', () => {
  let db: SophonDB;
  let memory: MemoryManager;

  beforeEach(() => {
    db = new SophonDB(TEST_DB);
    memory = new MemoryManager(db);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  it('should load short-term context from active topic', () => {
    const topic = db.createTopic('Test topic');
    db.addMessage(topic.id, 'user', 'Question 1');
    db.addMessage(topic.id, 'assistant', 'Answer 1');
    db.addMessage(topic.id, 'user', 'Question 2');

    const context = memory.loadShortTerm(topic.id);
    expect(context.messages).toHaveLength(3);
    expect(context.topicTitle).toBe('Test topic');
  });

  it('should trim short-term context for long threads', () => {
    const topic = db.createTopic('Long thread');
    for (let i = 0; i < 100; i++) {
      db.addMessage(topic.id, i % 2 === 0 ? 'user' : 'assistant', `Message ${i}`);
    }

    const context = memory.loadShortTerm(topic.id, 40);
    expect(context.messages.length).toBeLessThanOrEqual(40);
    expect(context.messages[0].content).toBe('Message 0');
    expect(context.messages[context.messages.length - 1].content).toBe('Message 99');
    expect(context.wasTrimmed).toBe(true);
  });

  it('should load long-term context from archived topics', () => {
    const t1 = db.createTopic('Stoicism');
    db.archiveTopic(t1.id, 'Discussed Stoic virtues and their modern applications', ['Virtue ethics still relevant']);

    const t2 = db.createTopic('Buddhism');
    db.archiveTopic(t2.id, 'Explored Buddhist impermanence and suffering', ['Attachment causes suffering']);

    const longTerm = memory.loadLongTerm();
    expect(longTerm.topics).toHaveLength(2);
    expect(longTerm.topics[0].summary).toBeDefined();
  });

  it('should build a complete context prompt', () => {
    const topic = db.createTopic('Active');
    db.addMessage(topic.id, 'user', 'Hello');

    const archived = db.createTopic('Old');
    db.archiveTopic(archived.id, 'Past discussion summary');

    db.upsertTrait('interests', 'existentialism', 'Deeply interested in existentialist thought', 0.8, []);

    const prompt = memory.buildContextPrompt(topic.id);
    expect(prompt).toContain('Active');
    expect(prompt).toContain('Past discussion summary');
    expect(prompt).toContain('existentialism');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd ~/Desktop/sophon/plugin
npx vitest run src/memory/__tests__/manager.test.ts
```
Expected: FAIL

**Step 3: Implement MemoryManager**

Create `~/Desktop/sophon/plugin/src/memory/manager.ts`:
```typescript
import { SophonDB, type Message, type PersonalityTrait } from '../db/database.js';

export interface ShortTermContext {
  topicTitle: string;
  messages: Message[];
  wasTrimmed: boolean;
}

export interface LongTermContext {
  topics: Array<{ title: string; summary: string | null; insights: string[] }>;
}

export class MemoryManager {
  constructor(private db: SophonDB) {}

  loadShortTerm(topicId: string, maxMessages: number = 50): ShortTermContext {
    const topic = this.db.getTopic(topicId);
    if (!topic) {
      return { topicTitle: 'Unknown', messages: [], wasTrimmed: false };
    }

    const allMessages = this.db.getTopicMessages(topicId);

    if (allMessages.length <= maxMessages) {
      return {
        topicTitle: topic.title,
        messages: allMessages,
        wasTrimmed: false,
      };
    }

    // Keep first 5 messages for context + last (maxMessages - 5)
    const keepStart = 5;
    const keepEnd = maxMessages - keepStart;
    const trimmed = [
      ...allMessages.slice(0, keepStart),
      ...allMessages.slice(-keepEnd),
    ];

    return {
      topicTitle: topic.title,
      messages: trimmed,
      wasTrimmed: true,
    };
  }

  loadLongTerm(limit: number = 5): LongTermContext {
    const archived = this.db.getTopicsByStatus('archived');
    const recent = archived.slice(0, limit);

    return {
      topics: recent.map((t) => ({
        title: t.title,
        summary: t.summary,
        insights: t.key_insights ? JSON.parse(t.key_insights) : [],
      })),
    };
  }

  buildContextPrompt(activeTopicId: string): string {
    const shortTerm = this.loadShortTerm(activeTopicId);
    const longTerm = this.loadLongTerm();
    const traits = this.db.getAllTraits();

    let prompt = '';

    // Personality context
    if (traits.length > 0) {
      prompt += '## What I Know About You\n\n';
      const categories = new Map<string, PersonalityTrait[]>();
      for (const t of traits) {
        const list = categories.get(t.category) || [];
        list.push(t);
        categories.set(t.category, list);
      }
      for (const [cat, items] of categories) {
        prompt += `**${cat}:**\n`;
        for (const item of items) {
          prompt += `- ${item.key}: ${item.value} (confidence: ${(item.confidence * 100).toFixed(0)}%)\n`;
        }
        prompt += '\n';
      }
    }

    // Long-term memories
    if (longTerm.topics.length > 0) {
      prompt += '## Past Conversations\n\n';
      for (const t of longTerm.topics) {
        prompt += `**${t.title}:**\n`;
        if (t.summary) prompt += `${t.summary}\n`;
        if (t.insights.length > 0) {
          prompt += 'Key insights: ' + t.insights.join('; ') + '\n';
        }
        prompt += '\n';
      }
    }

    // Current topic context
    prompt += `## Current Topic: ${shortTerm.topicTitle}\n\n`;
    if (shortTerm.wasTrimmed) {
      prompt += '*[Earlier messages trimmed for context window]*\n\n';
    }

    return prompt;
  }

  formatMessagesForLLM(topicId: string): Array<{ role: string; content: string }> {
    const shortTerm = this.loadShortTerm(topicId);
    return shortTerm.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }
}
```

**Step 4: Run tests**

```bash
cd ~/Desktop/sophon/plugin
npx vitest run src/memory/__tests__/manager.test.ts
```
Expected: All 4 tests PASS

**Step 5: Commit**

```bash
cd ~/Desktop/sophon
git add plugin/src/memory/
git commit -m "feat: add memory manager with short-term/long-term context loading"
```

---

## Task 7: Personality Profiler

**Files:**
- Create: `~/Desktop/sophon/plugin/src/personality/profiler.ts`
- Create: `~/Desktop/sophon/plugin/src/personality/prompts.ts`
- Create: `~/Desktop/sophon/plugin/src/personality/__tests__/profiler.test.ts`

**Step 1: Write failing tests**

Create `~/Desktop/sophon/plugin/src/personality/__tests__/profiler.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PersonalityProfiler } from '../profiler.js';
import { SophonDB } from '../../db/database.js';
import fs from 'fs';
import path from 'path';

const TEST_DB = path.join(__dirname, 'test-personality.db');

describe('PersonalityProfiler', () => {
  let db: SophonDB;
  let profiler: PersonalityProfiler;

  beforeEach(() => {
    db = new SophonDB(TEST_DB);
    profiler = new PersonalityProfiler(db);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  it('should format the full profile as readable text', () => {
    db.upsertTrait('interests', 'existentialism', 'Drawn to existentialist questions', 0.7, []);
    db.upsertTrait('strengths', 'integrative_thinking', 'Connects ideas across traditions', 0.6, []);

    const output = profiler.formatProfile();
    expect(output).toContain('existentialism');
    expect(output).toContain('integrative_thinking');
    expect(output).toContain('70%');
  });

  it('should build the extraction prompt for Claude', () => {
    const messages = [
      { role: 'user', content: 'I think free will is an illusion shaped by deterministic forces' },
      { role: 'assistant', content: 'That is a strong claim...' },
    ];
    const prompt = profiler.buildExtractionPrompt(messages);
    expect(prompt).toContain('free will');
    expect(prompt).toContain('personality');
  });

  it('should parse extraction results and update DB', () => {
    const extractionResult = JSON.stringify({
      observations: [
        {
          category: 'interests',
          key: 'determinism',
          value: 'Interested in determinism and free will debates',
          confidence_delta: 0.2,
        },
        {
          category: 'reasoning_style',
          key: 'analytical',
          value: 'Tends to approach metaphysical questions analytically',
          confidence_delta: 0.15,
        },
      ],
    });

    profiler.applyExtraction(extractionResult, ['msg-1', 'msg-2']);

    const interests = db.getTraitsByCategory('interests');
    expect(interests).toHaveLength(1);
    expect(interests[0].key).toBe('determinism');
    expect(interests[0].confidence).toBeCloseTo(0.2, 1);
  });

  it('should increase confidence on repeated observations', () => {
    db.upsertTrait('interests', 'stoicism', 'Interest in Stoic philosophy', 0.3, []);

    const extractionResult = JSON.stringify({
      observations: [
        {
          category: 'interests',
          key: 'stoicism',
          value: 'Deep and sustained interest in Stoicism, especially Marcus Aurelius',
          confidence_delta: 0.2,
        },
      ],
    });

    profiler.applyExtraction(extractionResult, ['msg-3']);

    const traits = db.getTraitsByCategory('interests');
    const stoicism = traits.find((t) => t.key === 'stoicism');
    expect(stoicism!.confidence).toBeCloseTo(0.5, 1);
    expect(stoicism!.value).toContain('Marcus Aurelius');
  });

  it('should build a reflection prompt', () => {
    db.upsertTrait('interests', 'love', 'Thinks deeply about love', 0.6, []);
    db.upsertTrait('emotional_patterns', 'analytical_deflection', 'Sometimes intellectualizes emotions', 0.4, []);

    const prompt = profiler.buildReflectionPrompt();
    expect(prompt).toContain('love');
    expect(prompt).toContain('analytical_deflection');
    expect(prompt).toContain('reflection');
  });
});
```

**Step 2: Run tests to verify failure**

```bash
cd ~/Desktop/sophon/plugin
npx vitest run src/personality/__tests__/profiler.test.ts
```
Expected: FAIL

**Step 3: Create the prompts file**

Create `~/Desktop/sophon/plugin/src/personality/prompts.ts`:
```typescript
export const EXTRACTION_SYSTEM_PROMPT = `You are a personality analysis assistant. Given a conversation exchange, identify any personality-relevant signals.

Return a JSON object with this structure:
{
  "observations": [
    {
      "category": "interests" | "reasoning_style" | "emotional_patterns" | "growth_areas" | "strengths",
      "key": "short_snake_case_name",
      "value": "Description of what you observed",
      "confidence_delta": 0.05 to 0.3
    }
  ]
}

Guidelines:
- Only include observations with genuine signal. No filler.
- confidence_delta should be low (0.05-0.1) for weak signals, higher (0.2-0.3) for clear, repeated patterns.
- If there are no personality-relevant signals, return {"observations": []}.
- Focus on: intellectual interests, reasoning patterns, emotional tendencies, blind spots, and strengths.
- Do NOT pathologize normal emotions. "I feel sad" is not a growth area.
- Be specific: "interested in Stoic virtue ethics" not "interested in philosophy".`;

export const REFLECTION_SYSTEM_PROMPT = `You are writing a thoughtful personal reflection for someone based on their personality profile built over multiple conversations.

Write 2-3 paragraphs that:
1. Note patterns and themes in their recent thinking
2. Identify growth or evolution in their ideas
3. Gently name any blind spots or areas worth exploring
4. Be warm but honest - this is insight, not flattery

Use second person ("you"). Be specific, not generic. Reference actual traits from the profile.
Ground observations in psychological or philosophical frameworks where relevant.`;
```

**Step 4: Implement the profiler**

Create `~/Desktop/sophon/plugin/src/personality/profiler.ts`:
```typescript
import { SophonDB, type PersonalityTrait } from '../db/database.js';
import { EXTRACTION_SYSTEM_PROMPT, REFLECTION_SYSTEM_PROMPT } from './prompts.js';

interface Observation {
  category: string;
  key: string;
  value: string;
  confidence_delta: number;
}

interface ExtractionResult {
  observations: Observation[];
}

export class PersonalityProfiler {
  constructor(private db: SophonDB) {}

  formatProfile(): string {
    const traits = this.db.getAllTraits();
    if (traits.length === 0) return 'No personality observations yet.';

    const categories = new Map<string, PersonalityTrait[]>();
    for (const t of traits) {
      const list = categories.get(t.category) || [];
      list.push(t);
      categories.set(t.category, list);
    }

    let output = '## Your Personality Profile\n\n';
    for (const [category, items] of categories) {
      output += `**${category.replace(/_/g, ' ')}:**\n`;
      for (const item of items) {
        output += `- **${item.key.replace(/_/g, ' ')}**: ${item.value} *(${(item.confidence * 100).toFixed(0)}% confidence)*\n`;
      }
      output += '\n';
    }
    return output;
  }

  buildExtractionPrompt(
    messages: Array<{ role: string; content: string }>
  ): string {
    const conversation = messages
      .map((m) => `[${m.role}]: ${m.content}`)
      .join('\n\n');

    return `${EXTRACTION_SYSTEM_PROMPT}\n\n---\n\nConversation to analyze for personality signals:\n\n${conversation}\n\nReturn your JSON analysis:`;
  }

  applyExtraction(jsonResult: string, messageIds: string[]): void {
    let parsed: ExtractionResult;
    try {
      parsed = JSON.parse(jsonResult);
    } catch {
      return;
    }

    for (const obs of parsed.observations) {
      const existing = this.db
        .getTraitsByCategory(obs.category)
        .find((t) => t.key === obs.key);

      const newConfidence = existing
        ? Math.min(1.0, existing.confidence + obs.confidence_delta)
        : obs.confidence_delta;

      this.db.upsertTrait(
        obs.category,
        obs.key,
        obs.value,
        newConfidence,
        messageIds
      );
    }
  }

  buildReflectionPrompt(): string {
    const profile = this.formatProfile();
    return `${REFLECTION_SYSTEM_PROMPT}\n\n---\n\nCurrent personality profile:\n\n${profile}\n\nWrite your reflection:`;
  }

  shouldReflect(): boolean {
    const count = this.db.getMessageCount();
    return count > 0 && count % 20 === 0;
  }
}
```

**Step 5: Run tests**

```bash
cd ~/Desktop/sophon/plugin
npx vitest run src/personality/__tests__/profiler.test.ts
```
Expected: All 5 tests PASS

**Step 6: Commit**

```bash
cd ~/Desktop/sophon
git add plugin/src/personality/
git commit -m "feat: add personality profiler with extraction, confidence tracking, and reflections"
```

---

## Task 8: Conversation Curator Tools

**Files:**
- Create: `~/Desktop/sophon/plugin/src/tools/curator.ts`
- Create: `~/Desktop/sophon/plugin/src/tools/__tests__/curator.test.ts`

**Step 1: Write failing tests**

Create `~/Desktop/sophon/plugin/src/tools/__tests__/curator.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CuratorTools } from '../curator.js';
import { SophonDB } from '../../db/database.js';
import fs from 'fs';
import path from 'path';

const TEST_DB = path.join(__dirname, 'test-curator.db');

describe('CuratorTools', () => {
  let db: SophonDB;
  let curator: CuratorTools;

  beforeEach(() => {
    db = new SophonDB(TEST_DB);
    curator = new CuratorTools(db);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  it('should edit a message and confirm', async () => {
    const topic = db.createTopic('Test');
    const msg = db.addMessage(topic.id, 'user', 'Original question');

    const result = await curator.editMessage({
      message_id: msg.id,
      new_content: 'Revised question about Kant',
    });
    expect(result.content).toContain('edited');
    expect(result.content).toContain('Revised question about Kant');
  });

  it('should soft-delete a message', async () => {
    const topic = db.createTopic('Test');
    const msg = db.addMessage(topic.id, 'user', 'Off-topic rambling');

    const result = await curator.deleteMessage({ message_id: msg.id });
    expect(result.content).toContain('deleted');

    const messages = db.getTopicMessages(topic.id);
    expect(messages).toHaveLength(0);
  });

  it('should show cross-topic insights', async () => {
    const t1 = db.createTopic('Love');
    const t2 = db.createTopic('Attachment theory');
    db.addConnection(t1.id, t2.id, 'Your views on love evolved after studying attachment styles');

    const result = await curator.showInsights({});
    expect(result.content).toContain('Love');
    expect(result.content).toContain('Attachment theory');
    expect(result.content).toContain('evolved');
  });
});
```

**Step 2: Run tests to verify failure**

```bash
cd ~/Desktop/sophon/plugin
npx vitest run src/tools/__tests__/curator.test.ts
```
Expected: FAIL

**Step 3: Implement CuratorTools**

Create `~/Desktop/sophon/plugin/src/tools/curator.ts`:
```typescript
import { SophonDB } from '../db/database.js';
import type { ToolResult } from '../types.js';

export class CuratorTools {
  constructor(private db: SophonDB) {}

  async editMessage(params: {
    message_id: string;
    new_content: string;
  }): Promise<ToolResult> {
    const msg = this.db.getMessage(params.message_id);
    if (!msg) {
      return { content: 'Message not found.', error: 'not_found' };
    }

    this.db.editMessage(params.message_id, params.new_content);
    return {
      content: `**Message edited** (${msg.role}):\n- Before: ${msg.content.slice(0, 100)}\n- After: ${params.new_content.slice(0, 100)}`,
    };
  }

  async deleteMessage(params: { message_id: string }): Promise<ToolResult> {
    const msg = this.db.getMessage(params.message_id);
    if (!msg) {
      return { content: 'Message not found.', error: 'not_found' };
    }

    this.db.deleteMessage(params.message_id);
    return {
      content: `**Message deleted** (${msg.role}): "${msg.content.slice(0, 80)}..."`,
    };
  }

  async showInsights(_params: Record<string, unknown>): Promise<ToolResult> {
    const topics = [
      ...this.db.getTopicsByStatus('active'),
      ...this.db.getTopicsByStatus('archived'),
    ];

    if (topics.length === 0) {
      return { content: 'No topics yet - no insights to show.' };
    }

    let output = '## Cross-Topic Insights\n\n';
    let hasConnections = false;

    for (const topic of topics) {
      const connections = this.db.getConnectionsForTopic(topic.id);
      if (connections.length > 0) {
        hasConnections = true;
        for (const conn of connections) {
          const other =
            conn.topic_a_id === topic.id
              ? this.db.getTopic(conn.topic_b_id)
              : this.db.getTopic(conn.topic_a_id);
          output += `- **${topic.title}** <-> **${other?.title ?? 'Unknown'}**: ${conn.relationship}\n`;
        }
      }
    }

    if (!hasConnections) {
      output += 'No cross-topic connections identified yet. These emerge as you discuss more topics.\n';
    }

    return { content: output };
  }
}
```

**Step 4: Run tests**

```bash
cd ~/Desktop/sophon/plugin
npx vitest run src/tools/__tests__/curator.test.ts
```
Expected: All 3 tests PASS

**Step 5: Commit**

```bash
cd ~/Desktop/sophon
git add plugin/src/tools/curator.ts plugin/src/tools/__tests__/curator.test.ts
git commit -m "feat: add conversation curator tools (edit, delete, insights)"
```

---

## Task 9: Wire Up Plugin - Register All Tools

**Files:**
- Modify: `~/Desktop/sophon/plugin/src/index.ts`
- Create: `~/Desktop/sophon/plugin/src/tools/register.ts`

**Step 1: Create the tool registration module**

Create `~/Desktop/sophon/plugin/src/tools/register.ts`:
```typescript
import { SophonDB } from '../db/database.js';
import { TopicTools } from './topics.js';
import { CuratorTools } from './curator.js';
import { MemoryManager } from '../memory/manager.js';
import { PersonalityProfiler } from '../personality/profiler.js';
import type { PluginAPI } from '../types.js';
import path from 'path';
import os from 'os';

export function registerAllTools(api: PluginAPI): void {
  const dbPath = path.join(os.homedir(), '.sophon', 'sophon.db');
  const db = new SophonDB(dbPath);
  const topics = new TopicTools(db);
  const curator = new CuratorTools(db);
  const memory = new MemoryManager(db);
  const profiler = new PersonalityProfiler(db);

  // Topic tools
  api.registerTool({
    name: 'sophon_topic_new',
    description: 'Start a new conversation topic thread',
    parameters: {
      title: { type: 'string', description: 'Title for the new topic', required: true },
    },
    run: (params) => topics.newTopic(params as { title: string }),
  });

  api.registerTool({
    name: 'sophon_topic_list',
    description: 'List all conversation topics grouped by status',
    parameters: {},
    run: () => topics.listTopics({}),
  });

  api.registerTool({
    name: 'sophon_topic_resume',
    description: 'Resume a previous conversation topic by searching its title',
    parameters: {
      query: { type: 'string', description: 'Search term to find the topic', required: true },
    },
    run: (params) => topics.resumeTopic(params as { query: string }),
  });

  api.registerTool({
    name: 'sophon_topic_archive',
    description: 'Archive the current active topic with a summary and key insights',
    parameters: {
      summary: { type: 'string', description: 'Summary of the conversation' },
      key_insights: { type: 'string', description: 'JSON array of key insight strings' },
    },
    run: (params) => {
      const insights = params.key_insights
        ? JSON.parse(params.key_insights as string)
        : undefined;
      return topics.archiveTopic({
        summary: params.summary as string,
        key_insights: insights,
      });
    },
  });

  api.registerTool({
    name: 'sophon_topic_get_active',
    description: 'Get the current active topic with recent messages',
    parameters: {},
    run: () => topics.getActive({}),
  });

  // Memory tools
  api.registerTool({
    name: 'sophon_memory_load',
    description: 'Load relevant long-term context from archived topics and personality profile',
    parameters: {
      topic_id: { type: 'string', description: 'The active topic ID to load context for', required: true },
    },
    run: (params) => {
      const context = memory.buildContextPrompt(params.topic_id as string);
      return Promise.resolve({ content: context });
    },
  });

  // Curator tools
  api.registerTool({
    name: 'sophon_message_edit',
    description: 'Edit a past message in the conversation',
    parameters: {
      message_id: { type: 'string', description: 'ID of the message to edit', required: true },
      new_content: { type: 'string', description: 'New content for the message', required: true },
    },
    run: (params) =>
      curator.editMessage(params as { message_id: string; new_content: string }),
  });

  api.registerTool({
    name: 'sophon_message_delete',
    description: 'Soft-delete an off-topic message so it is excluded from memory',
    parameters: {
      message_id: { type: 'string', description: 'ID of the message to delete', required: true },
    },
    run: (params) =>
      curator.deleteMessage(params as { message_id: string }),
  });

  // Personality tools
  api.registerTool({
    name: 'sophon_personality_get',
    description: 'View the current personality profile with all observed traits and confidence levels',
    parameters: {},
    run: () => {
      const output = profiler.formatProfile();
      return Promise.resolve({ content: output });
    },
  });

  api.registerTool({
    name: 'sophon_personality_update',
    description: 'Update personality profile based on recent conversation analysis',
    parameters: {
      extraction_json: {
        type: 'string',
        description: 'JSON string with observations from conversation analysis',
        required: true,
      },
      message_ids: {
        type: 'string',
        description: 'JSON array of message IDs that informed these observations',
        required: true,
      },
    },
    run: (params) => {
      const ids = JSON.parse(params.message_ids as string);
      profiler.applyExtraction(params.extraction_json as string, ids);
      return Promise.resolve({ content: 'Personality profile updated.' });
    },
  });

  api.registerTool({
    name: 'sophon_insights',
    description: 'Show cross-topic connections and insights',
    parameters: {},
    run: () => curator.showInsights({}),
  });

  api.registerTool({
    name: 'sophon_reflect',
    description: 'Generate a periodic personality reflection based on accumulated observations',
    parameters: {},
    run: () => {
      const prompt = profiler.buildReflectionPrompt();
      return Promise.resolve({
        content: `Use this prompt with the LLM to generate a reflection:\n\n${prompt}`,
      });
    },
  });

  console.log('[Sophon] Registered 12 tools');
}
```

**Step 2: Update the plugin entry point**

Replace `~/Desktop/sophon/plugin/src/index.ts`:
```typescript
import type { PluginAPI } from './types.js';
import { registerAllTools } from './tools/register.js';

export const id = 'sophon';
export const name = 'Sophon - Humanities Companion';

export function register(api: PluginAPI) {
  registerAllTools(api);
  console.log('[Sophon] Plugin loaded successfully');
}
```

**Step 3: Run all tests to ensure nothing broke**

```bash
cd ~/Desktop/sophon/plugin
npx vitest run
```
Expected: All tests pass

**Step 4: Commit**

```bash
cd ~/Desktop/sophon
git add plugin/src/index.ts plugin/src/tools/register.ts
git commit -m "feat: wire up all Sophon tools in plugin entry point"
```

---

## Task 10: Create OpenClaw Skills for User Commands

**Files:**
- Create: `~/Desktop/sophon/plugin/skills/topic/SKILL.md`
- Create: `~/Desktop/sophon/plugin/skills/profile/SKILL.md`
- Create: `~/Desktop/sophon/plugin/skills/reflect/SKILL.md`

**Step 1: Create topic management skill**

Create `~/Desktop/sophon/plugin/skills/topic/SKILL.md`:
```markdown
---
name: topic
description: Manage conversation topics - create, list, resume, or archive
user-invocable: true
---

# Topic Management

When the user invokes /topic, determine the action from their message:

- **"new [title]"**: Call sophon_topic_new with the given title
- **"list"**: Call sophon_topic_list
- **"resume [query]"**: Call sophon_topic_resume with the search query
- **"archive"**: First generate a summary and key insights from the current conversation, then call sophon_topic_archive

If no action is specified, call sophon_topic_list to show available topics.
```

**Step 2: Create profile skill**

Create `~/Desktop/sophon/plugin/skills/profile/SKILL.md`:
```markdown
---
name: profile
description: View or edit your personality profile
user-invocable: true
---

# Personality Profile

When the user invokes /profile:

- **No arguments**: Call sophon_personality_get and display the full profile
- **"edit"**: Ask the user which trait they want to modify, then update it
- **"reset"**: Confirm with the user, then clear all personality data
```

**Step 3: Create reflect skill**

Create `~/Desktop/sophon/plugin/skills/reflect/SKILL.md`:
```markdown
---
name: reflect
description: Generate a thoughtful reflection on your intellectual and emotional patterns
user-invocable: true
---

# Personal Reflection

When the user invokes /reflect:

1. Call sophon_reflect to get the reflection prompt
2. Use the prompt to generate a 2-3 paragraph reflection
3. Present it conversationally, as if sharing an observation with a friend
4. Ask if any part resonates or if they'd like to discuss a specific observation
```

**Step 4: Commit**

```bash
cd ~/Desktop/sophon
git add plugin/skills/
git commit -m "feat: add OpenClaw skills for topic, profile, and reflect commands"
```

---

## Task 11: Add README and Final Integration

**Files:**
- Create: `~/Desktop/sophon/README.md`
- Modify: `~/Desktop/sophon/plugin/package.json` - add test script

**Step 1: Add test script to package.json**

In `~/Desktop/sophon/plugin/package.json`, ensure scripts section has:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "tsc"
  }
}
```

**Step 2: Create README**

Create `~/Desktop/sophon/README.md`:
```markdown
# Sophon

A humanities-focused conversational companion built on [OpenClaw](https://github.com/openclaw/openclaw).

Sophon is your Socratic challenger - a philosophical companion that discusses literature, philosophy, relationships, and religion with intellectual honesty. It remembers your conversations, builds an understanding of your personality over time, and gives you honest feedback.

## Features

- **Topic-based conversations** - Organize discussions into named threads
- **Short-term and long-term memory** - Full context in active threads, summarized insights from past ones
- **Personality profiling** - Evolving understanding of your intellectual interests, reasoning style, and emotional patterns
- **Conversation curation** - Edit or remove off-topic messages to keep threads focused
- **Socratic challenger** - Pushes back on weak reasoning, plays devil's advocate, never just agrees
- **Emotionally grounded** - Treats emotions as data, not emergencies

## Requirements

- [OpenClaw](https://github.com/openclaw/openclaw) installed and configured
- Node.js >= 22
- An Anthropic API key (for Claude)

## Installation

```bash
git clone <this-repo> ~/Desktop/sophon
cd ~/Desktop/sophon
bash install.sh
```

## Usage

Start OpenClaw normally - Sophon loads as a plugin:

```bash
openclaw
```

### Commands

| Command | Description |
|---------|-------------|
| /topic new <name> | Start a new conversation thread |
| /topic list | Show all topics |
| /topic resume <query> | Resume a previous topic |
| /topic archive | Archive current topic with summary |
| /profile | View your personality profile |
| /profile edit | Modify personality traits |
| /reflect | Get a personal reflection |

### Discord

Sophon works through OpenClaw's Discord integration. Set up a Discord bot via OpenClaw's channel config, and Sophon's tools and persona are available in DMs.

## Data

All data is stored locally at ~/.sophon/sophon.db (SQLite). Nothing leaves your machine except API calls to Claude.

## Development

```bash
cd plugin
npm install
npm test          # run tests
npm run build     # compile TypeScript
```
```

**Step 3: Run full test suite one final time**

```bash
cd ~/Desktop/sophon/plugin
npm test
```
Expected: All tests pass

**Step 4: Commit**

```bash
cd ~/Desktop/sophon
git add README.md plugin/package.json
git commit -m "docs: add README and finalize package scripts"
```

---

## Summary of Tasks

| # | Task | Tests | Key Files |
|---|------|-------|-----------|
| 1 | Install OpenClaw | Manual | ~/.openclaw/ |
| 2 | Scaffold plugin | None | plugin/src/index.ts, manifest |
| 3 | Database layer | 6 tests | plugin/src/db/ |
| 4 | Workspace config | None | workspace/SOUL.md, AGENTS.md |
| 5 | Topic tools | 5 tests | plugin/src/tools/topics.ts |
| 6 | Memory manager | 4 tests | plugin/src/memory/manager.ts |
| 7 | Personality profiler | 5 tests | plugin/src/personality/profiler.ts |
| 8 | Curator tools | 3 tests | plugin/src/tools/curator.ts |
| 9 | Wire up plugin | Integration | plugin/src/tools/register.ts |
| 10 | Skills | None | plugin/skills/ |
| 11 | README and finalize | Full suite | README.md |
