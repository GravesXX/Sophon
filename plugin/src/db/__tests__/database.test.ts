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
