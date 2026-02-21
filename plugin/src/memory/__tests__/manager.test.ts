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
