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
