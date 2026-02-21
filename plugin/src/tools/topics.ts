import { SophonDB } from '../db/database.js';
import type { ToolResult } from '../types.js';

export class TopicTools {
  constructor(private db: SophonDB) {}

  async newTopic(params: { title: string }): Promise<ToolResult> {
    const topic = this.db.createTopic(params.title);
    return {
      content: [
        `**New topic created**`,
        `- **Title:** ${topic.title}`,
        `- **ID:** ${topic.id}`,
        `- **Status:** ${topic.status}`,
        `- **Created:** ${topic.created_at}`,
      ].join('\n'),
    };
  }

  async listTopics(_params: Record<string, unknown>): Promise<ToolResult> {
    const active = this.db.getTopicsByStatus('active');
    const archived = this.db.getTopicsByStatus('archived');

    const formatTopic = (t: { id: string; title: string; updated_at: string }) => {
      const messages = this.db.getTopicMessages(t.id);
      return `  - **${t.title}** (${messages.length} messages, updated ${t.updated_at})`;
    };

    const sections: string[] = [];

    sections.push(`### active (${active.length})`);
    if (active.length === 0) {
      sections.push('  _No active topics_');
    } else {
      for (const t of active) {
        sections.push(formatTopic(t));
      }
    }

    sections.push('');
    sections.push(`### archived (${archived.length})`);
    if (archived.length === 0) {
      sections.push('  _No archived topics_');
    } else {
      for (const t of archived) {
        sections.push(formatTopic(t));
      }
    }

    return { content: sections.join('\n') };
  }

  async resumeTopic(params: { query: string }): Promise<ToolResult> {
    const allTopics = [
      ...this.db.getTopicsByStatus('active'),
      ...this.db.getTopicsByStatus('archived'),
    ];

    const queryLower = params.query.toLowerCase();
    const match = allTopics.find((t) => t.title.toLowerCase().includes(queryLower));

    if (!match) {
      return {
        content: `No topic found matching "${params.query}".`,
        error: 'topic_not_found',
      };
    }

    // Get the last 10 messages for context
    const messages = this.db.getTopicMessages(match.id);
    const recent = messages.slice(-10);

    const lines: string[] = [
      `**Resumed topic: ${match.title}**`,
      `- **ID:** ${match.id}`,
      `- **Status:** ${match.status}`,
      `- **Messages:** ${messages.length} total`,
      '',
      '**Recent messages:**',
    ];

    for (const msg of recent) {
      lines.push(`> **${msg.role}:** ${msg.content}`);
    }

    if (recent.length === 0) {
      lines.push('_No messages yet._');
    }

    return { content: lines.join('\n') };
  }

  async archiveTopic(params: {
    summary?: string;
    key_insights?: string[];
  }): Promise<ToolResult> {
    const active = this.db.getActiveTopic();

    if (!active) {
      return {
        content: 'No active topic to archive.',
        error: 'no_active_topic',
      };
    }

    this.db.archiveTopic(active.id, params.summary, params.key_insights);

    const lines: string[] = [
      `**Topic archived: ${active.title}**`,
      `- **ID:** ${active.id}`,
      `- **Status:** archived`,
    ];

    if (params.summary) {
      lines.push(`- **Summary:** ${params.summary}`);
    }

    if (params.key_insights && params.key_insights.length > 0) {
      lines.push('- **Key insights:**');
      for (const insight of params.key_insights) {
        lines.push(`  - ${insight}`);
      }
    }

    return { content: lines.join('\n') };
  }

  async getActive(_params: Record<string, unknown>): Promise<ToolResult> {
    const active = this.db.getActiveTopic();

    if (!active) {
      return {
        content: 'No active topic.',
        error: 'no_active_topic',
      };
    }

    const messages = this.db.getTopicMessages(active.id);
    const recent = messages.slice(-20);

    const lines: string[] = [
      `**Active topic: ${active.title}**`,
      `- **ID:** ${active.id}`,
      `- **Status:** ${active.status}`,
      `- **Created:** ${active.created_at}`,
      `- **Messages:** ${messages.length} total`,
      '',
      '**Recent messages:**',
    ];

    for (const msg of recent) {
      lines.push(`> **${msg.role}:** ${msg.content}`);
    }

    if (recent.length === 0) {
      lines.push('_No messages yet._');
    }

    return { content: lines.join('\n') };
  }
}
