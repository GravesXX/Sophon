import { v4 as uuidv4 } from 'uuid';
import { ObsidianAdapter } from 'obsidian-adapter';

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

// ── Message parsing helpers ─────────────────────────────────────────────────

const MSG_TAG_RE = /<!-- msg:([^:]+):deleted=(\d):edited=(.*?) -->/;

function formatMessage(msg: Message): string {
  const edited = msg.edited_at ?? '';
  return `### ${msg.created_at} — ${msg.role}\n${msg.content}\n<!-- msg:${msg.id}:deleted=${msg.is_deleted}:edited=${edited} -->`;
}

function parseMessages(body: string, topicId: string): Message[] {
  const messages: Message[] = [];
  const blocks = body.split(/(?=^### \d{4}-)/m);

  for (const block of blocks) {
    const headerMatch = block.match(/^### (\S+) — (\S+)\n/);
    const tagMatch = block.match(MSG_TAG_RE);
    if (!headerMatch || !tagMatch) continue;

    const contentStart = block.indexOf('\n') + 1;
    const contentEnd = block.lastIndexOf('<!-- msg:');
    const content = block.slice(contentStart, contentEnd).trim();

    messages.push({
      id: tagMatch[1],
      topic_id: topicId,
      role: headerMatch[2],
      content,
      created_at: headerMatch[1],
      edited_at: tagMatch[3] || null,
      is_deleted: parseInt(tagMatch[2], 10),
    });
  }
  return messages;
}

// ── Personality parsing helpers ─────────────────────────────────────────────

const TRAIT_TAG_RE = /<!-- trait:([^ ]+) -->/;

interface ParsedTrait {
  id: string;
  category: string;
  key: string;
  value: string;
  confidence: number;
  evidence: string;
  updated_at: string;
}

function parseProfileNote(body: string): ParsedTrait[] {
  const traits: ParsedTrait[] = [];
  let currentCategory = '';

  const lines = body.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Category heading (## interests, ## reasoning_style, etc.)
    if (line.startsWith('## ') && !line.startsWith('## Personality')) {
      currentCategory = line.slice(3).trim();
      i++;
      continue;
    }

    // Trait heading (### history_chinese)
    if (line.startsWith('### ') && currentCategory) {
      const key = line.slice(4).trim();
      let value = '';
      let confidence = 0;
      let evidence = '[]';
      let updated = '';
      let traitId = '';

      i++;
      while (i < lines.length && !lines[i].startsWith('## ') && !lines[i].startsWith('### ')) {
        const l = lines[i];
        if (l.startsWith('- **Value:**')) value = l.slice(12).trim();
        else if (l.startsWith('- **Confidence:**')) {
          const pct = l.slice(17).trim().replace('%', '');
          confidence = parseFloat(pct) / 100;
        } else if (l.startsWith('- **Evidence:**')) evidence = l.slice(15).trim();
        else if (l.startsWith('- **Updated:**')) updated = l.slice(14).trim();

        const tagMatch = l.match(TRAIT_TAG_RE);
        if (tagMatch) traitId = tagMatch[1];

        i++;
      }

      if (traitId && key) {
        traits.push({
          id: traitId,
          category: currentCategory,
          key,
          value,
          confidence,
          evidence,
          updated_at: updated,
        });
      }
      continue;
    }

    i++;
  }
  return traits;
}

function formatTrait(t: PersonalityTrait): string {
  const pct = Math.round(t.confidence * 100);
  return `### ${t.key}\n- **Value:** ${t.value}\n- **Confidence:** ${pct}%\n- **Evidence:** ${t.evidence}\n- **Updated:** ${t.updated_at}\n<!-- trait:${t.id} -->`;
}

function buildProfileBody(traits: PersonalityTrait[]): string {
  const byCategory = new Map<string, PersonalityTrait[]>();
  for (const t of traits) {
    const list = byCategory.get(t.category) || [];
    list.push(t);
    byCategory.set(t.category, list);
  }

  let body = '# Personality Profile\n';
  for (const [cat, catTraits] of byCategory) {
    body += `\n## ${cat}\n\n`;
    const sorted = catTraits.sort((a, b) => b.confidence - a.confidence);
    body += sorted.map(formatTrait).join('\n\n') + '\n';
  }
  return body;
}

// ── SophonDB ────────────────────────────────────────────────────────────────

export class SophonDB {
  private adapter: ObsidianAdapter;
  private readonly PROFILE_PATH = 'Personality/Profile.md';

  constructor(vaultPath: string) {
    this.adapter = new ObsidianAdapter(vaultPath, 'Agents/Sophon');

    // Ensure profile note exists
    this.adapter.ensureFolder('Personality');
    this.adapter.ensureFolder('Topics');
    this.adapter.ensureFolder('Connections');

    const existing = this.adapter.readNote(this.PROFILE_PATH);
    if (!existing) {
      this.adapter.createNote('Personality', 'Profile.md', {
        id: 'profile',
        type: 'sophon-personality',
        updated_at: new Date().toISOString(),
        tags: ['sophon', 'personality'],
      }, '# Personality Profile\n');
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  close(): void {
    // No-op for Obsidian adapter
  }

  // ── Introspection ───────────────────────────────────────────────────────

  listTables(): string[] {
    return ['topics', 'messages', 'personality', 'connections'];
  }

  // ── Topics ──────────────────────────────────────────────────────────────

  createTopic(title: string): Topic {
    const id = uuidv4();
    const now = new Date().toISOString();
    const filename = `${this.adapter.sanitize(title)} - ${this.adapter.shortId(id)}.md`;

    this.adapter.createNote('Topics', filename, {
      id,
      type: 'sophon-topic',
      title,
      status: 'active',
      created_at: now,
      updated_at: now,
      summary: null,
      key_insights: null,
      tags: ['sophon', 'topic'],
    }, `# ${title}\n\n## Summary\n\n## Key Insights\n\n## Conversation\n`);

    return this.getTopic(id)!;
  }

  getTopic(id: string): Topic | undefined {
    const entry = this.adapter.findById(id);
    if (!entry || entry.frontmatter.type !== 'sophon-topic') return undefined;
    const fm = entry.frontmatter;
    return {
      id: fm.id as string,
      title: fm.title as string,
      status: fm.status as string,
      created_at: fm.created_at as string,
      updated_at: fm.updated_at as string,
      summary: (fm.summary as string) ?? null,
      key_insights: fm.key_insights != null ? JSON.stringify(fm.key_insights) : null,
    };
  }

  getTopicsByStatus(status: string): Topic[] {
    return this.adapter.findByType('sophon-topic')
      .filter(e => e.frontmatter.status === status)
      .map(e => this.topicFromEntry(e))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  getActiveTopic(): Topic | undefined {
    const topics = this.getTopicsByStatus('active');
    return topics[0];
  }

  archiveTopic(id: string, summary?: string, keyInsights?: string[]): void {
    const entry = this.adapter.findById(id);
    if (!entry) return;

    this.adapter.updateFrontmatter(entry.relativePath, {
      status: 'archived',
      summary: summary ?? null,
      key_insights: keyInsights ?? null,
      updated_at: new Date().toISOString(),
    });

    // Update body with summary and insights
    const note = this.adapter.readNote(entry.relativePath);
    if (note) {
      let body = note.body;
      if (summary) {
        body = body.replace(/## Summary\n.*?(?=\n## )/s, `## Summary\n${summary}\n\n`);
      }
      if (keyInsights && keyInsights.length > 0) {
        const insightsStr = keyInsights.map(i => `- ${i}`).join('\n');
        body = body.replace(/## Key Insights\n.*?(?=\n## )/s, `## Key Insights\n${insightsStr}\n\n`);
      }
      this.adapter.replaceBody(entry.relativePath, body);
    }
  }

  updateTopicTimestamp(id: string): void {
    const entry = this.adapter.findById(id);
    if (!entry) return;
    this.adapter.updateFrontmatter(entry.relativePath, {
      updated_at: new Date().toISOString(),
    });
  }

  // ── Messages ────────────────────────────────────────────────────────────

  addMessage(topicId: string, role: string, content: string): Message {
    const id = uuidv4();
    const now = new Date().toISOString();
    const msg: Message = { id, topic_id: topicId, role, content, created_at: now, edited_at: null, is_deleted: 0 };

    const entry = this.adapter.findById(topicId);
    if (!entry) throw new Error(`Topic ${topicId} not found`);

    this.adapter.appendToBody(entry.relativePath, formatMessage(msg));
    this.updateTopicTimestamp(topicId);

    return msg;
  }

  getMessage(id: string): Message | undefined {
    // Search all topic notes for this message ID
    const topics = this.adapter.findByType('sophon-topic');
    for (const entry of topics) {
      const note = this.adapter.readNote(entry.relativePath);
      if (!note) continue;
      const msgs = parseMessages(note.body, entry.frontmatter.id as string);
      const found = msgs.find(m => m.id === id);
      if (found) return found;
    }
    return undefined;
  }

  getTopicMessages(topicId: string): Message[] {
    const entry = this.adapter.findById(topicId);
    if (!entry) return [];

    const note = this.adapter.readNote(entry.relativePath);
    if (!note) return [];

    return parseMessages(note.body, topicId).filter(m => m.is_deleted === 0);
  }

  editMessage(id: string, newContent: string): void {
    const topics = this.adapter.findByType('sophon-topic');
    for (const entry of topics) {
      const note = this.adapter.readNote(entry.relativePath);
      if (!note) continue;

      const msgs = parseMessages(note.body, entry.frontmatter.id as string);
      const target = msgs.find(m => m.id === id);
      if (!target) continue;

      // Update the message in the body
      target.content = newContent;
      target.edited_at = new Date().toISOString();
      const oldTag = `<!-- msg:${id}:deleted=${target.is_deleted}:edited=`;
      const newBody = note.body.replace(
        new RegExp(`### ${target.created_at} — ${target.role}\\n[\\s\\S]*?<!-- msg:${id}:deleted=\\d:edited=.*? -->`),
        formatMessage(target)
      );
      this.adapter.replaceBody(entry.relativePath, newBody);
      return;
    }
  }

  deleteMessage(id: string): void {
    const topics = this.adapter.findByType('sophon-topic');
    for (const entry of topics) {
      const note = this.adapter.readNote(entry.relativePath);
      if (!note) continue;

      if (!note.body.includes(`msg:${id}`)) continue;

      // Set deleted=1 in the comment tag
      const newBody = note.body.replace(
        new RegExp(`(<!-- msg:${id}:)deleted=0(:edited=.*? -->)`),
        '$1deleted=1$2'
      );
      this.adapter.replaceBody(entry.relativePath, newBody);
      return;
    }
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
    const allTraits = this.getAllTraits();
    const existing = allTraits.find(t => t.category === category && t.key === key);

    if (existing) {
      const existingEvidence: string[] = JSON.parse(existing.evidence || '[]');
      const merged = [...new Set([...existingEvidence, ...evidenceMessageIds])];
      const updated: PersonalityTrait = {
        ...existing,
        value,
        confidence,
        evidence: JSON.stringify(merged),
        updated_at: now,
      };

      // Rebuild all traits with the updated one
      const updatedTraits = allTraits.map(t =>
        t.id === existing.id ? updated : t
      );
      this.writeProfileNote(updatedTraits);
      return updated;
    } else {
      const id = uuidv4();
      const trait: PersonalityTrait = {
        id,
        category,
        key,
        value,
        confidence,
        evidence: JSON.stringify(evidenceMessageIds),
        updated_at: now,
      };

      const updatedTraits = [...allTraits, trait];
      this.writeProfileNote(updatedTraits);
      return trait;
    }
  }

  getTraitById(id: string): PersonalityTrait | undefined {
    return this.getAllTraits().find(t => t.id === id);
  }

  getTraitsByCategory(category: string): PersonalityTrait[] {
    return this.getAllTraits()
      .filter(t => t.category === category)
      .sort((a, b) => b.confidence - a.confidence);
  }

  getAllTraits(): PersonalityTrait[] {
    const note = this.adapter.readNote(this.PROFILE_PATH);
    if (!note) return [];

    return parseProfileNote(note.body).map(t => ({
      id: t.id,
      category: t.category,
      key: t.key,
      value: t.value,
      confidence: t.confidence,
      evidence: t.evidence,
      updated_at: t.updated_at,
    }));
  }

  deleteTrait(id: string): void {
    const traits = this.getAllTraits().filter(t => t.id !== id);
    this.writeProfileNote(traits);
  }

  // ── Connections ─────────────────────────────────────────────────────────

  addConnection(topicAId: string, topicBId: string, relationship: string): Connection {
    const id = uuidv4();
    const now = new Date().toISOString();

    const topicA = this.getTopic(topicAId);
    const topicB = this.getTopic(topicBId);
    const nameA = topicA ? this.adapter.sanitize(topicA.title) : topicAId.slice(0, 8);
    const nameB = topicB ? this.adapter.sanitize(topicB.title) : topicBId.slice(0, 8);
    const filename = `${nameA} x ${nameB} - ${this.adapter.shortId(id)}.md`;

    this.adapter.createNote('Connections', filename, {
      id,
      type: 'sophon-connection',
      topic_a_id: topicAId,
      topic_b_id: topicBId,
      created_at: now,
      tags: ['sophon', 'connection'],
    }, `# Connection\n\n**Relationship:** ${relationship}\n\n**Topics:**\n- [[${nameA}]]\n- [[${nameB}]]\n`);

    return { id, topic_a_id: topicAId, topic_b_id: topicBId, relationship, created_at: now };
  }

  getConnectionsForTopic(topicId: string): Connection[] {
    const all = this.adapter.findByType('sophon-connection');
    const results: Connection[] = [];
    for (const entry of all) {
      const fm = entry.frontmatter;
      if (fm.topic_a_id === topicId || fm.topic_b_id === topicId) {
        const note = this.adapter.readNote(entry.relativePath);
        const relMatch = note?.body.match(/\*\*Relationship:\*\* (.+)/);
        results.push({
          id: fm.id as string,
          topic_a_id: fm.topic_a_id as string,
          topic_b_id: fm.topic_b_id as string,
          relationship: relMatch?.[1] ?? '',
          created_at: fm.created_at as string,
        });
      }
    }
    return results.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  // ── Stats ───────────────────────────────────────────────────────────────

  getMessageCount(): number {
    let count = 0;
    const topics = this.adapter.findByType('sophon-topic');
    for (const entry of topics) {
      const note = this.adapter.readNote(entry.relativePath);
      if (!note) continue;
      const msgs = parseMessages(note.body, entry.frontmatter.id as string);
      count += msgs.filter(m => m.is_deleted === 0).length;
    }
    return count;
  }

  getTopicCount(): number {
    return this.adapter.findByType('sophon-topic').length;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private topicFromEntry(entry: { frontmatter: Record<string, unknown> }): Topic {
    const fm = entry.frontmatter;
    return {
      id: fm.id as string,
      title: fm.title as string,
      status: fm.status as string,
      created_at: fm.created_at as string,
      updated_at: fm.updated_at as string,
      summary: (fm.summary as string) ?? null,
      key_insights: fm.key_insights != null ? JSON.stringify(fm.key_insights) : null,
    };
  }

  private writeProfileNote(traits: PersonalityTrait[]): void {
    const body = buildProfileBody(traits);
    this.adapter.updateFrontmatter(this.PROFILE_PATH, {
      updated_at: new Date().toISOString(),
    });
    this.adapter.replaceBody(this.PROFILE_PATH, body);
  }
}
