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
