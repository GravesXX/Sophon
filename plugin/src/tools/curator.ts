import { SophonDB } from '../db/database.js';
import type { ToolResult } from '../types.js';

export class CuratorTools {
  constructor(private db: SophonDB) {}

  async editMessage(params: { message_id: string; new_content: string }): Promise<ToolResult> {
    const message = this.db.getMessage(params.message_id);
    if (!message) {
      return {
        content: `Message with ID "${params.message_id}" not found.`,
        error: 'message_not_found',
      };
    }

    const originalContent = message.content;
    this.db.editMessage(params.message_id, params.new_content);

    return {
      content: [
        `**Message edited**`,
        `- **ID:** ${params.message_id}`,
        `- **Before:** ${originalContent}`,
        `- **After:** ${params.new_content}`,
      ].join('\n'),
    };
  }

  async deleteMessage(params: { message_id: string }): Promise<ToolResult> {
    const message = this.db.getMessage(params.message_id);
    if (!message) {
      return {
        content: `Message with ID "${params.message_id}" not found.`,
        error: 'message_not_found',
      };
    }

    this.db.deleteMessage(params.message_id);

    return {
      content: [
        `**Message deleted**`,
        `- **ID:** ${params.message_id}`,
        `- **Role:** ${message.role}`,
        `- **Content:** ${message.content}`,
      ].join('\n'),
    };
  }

  async showInsights(_params: Record<string, unknown>): Promise<ToolResult> {
    const active = this.db.getTopicsByStatus('active');
    const archived = this.db.getTopicsByStatus('archived');
    const allTopics = [...active, ...archived];

    if (allTopics.length === 0) {
      return {
        content: 'No topics yet. Cross-topic insights will emerge as you explore more conversations.',
      };
    }

    // Collect all unique connections across topics
    const seenConnectionIds = new Set<string>();
    const connections: Array<{
      topicA: string;
      topicB: string;
      relationship: string;
    }> = [];

    for (const topic of allTopics) {
      const topicConnections = this.db.getConnectionsForTopic(topic.id);
      for (const conn of topicConnections) {
        if (!seenConnectionIds.has(conn.id)) {
          seenConnectionIds.add(conn.id);

          const topicA = this.db.getTopic(conn.topic_a_id);
          const topicB = this.db.getTopic(conn.topic_b_id);

          connections.push({
            topicA: topicA?.title ?? conn.topic_a_id,
            topicB: topicB?.title ?? conn.topic_b_id,
            relationship: conn.relationship,
          });
        }
      }
    }

    if (connections.length === 0) {
      return {
        content: [
          `**Cross-topic insights**`,
          '',
          `You have ${allTopics.length} topic(s) but no connections between them yet.`,
          'Insights will emerge over time as themes recur across conversations.',
        ].join('\n'),
      };
    }

    const lines: string[] = [
      `**Cross-topic insights**`,
      '',
    ];

    for (const conn of connections) {
      lines.push(`- **${conn.topicA}** <-> **${conn.topicB}**: ${conn.relationship}`);
    }

    return { content: lines.join('\n') };
  }
}
