import { SophonDB, Message, PersonalityTrait } from '../db/database.js';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface ShortTermContext {
  topicTitle: string;
  messages: Message[];
  wasTrimmed: boolean;
}

export interface ArchivedTopicSummary {
  id: string;
  title: string;
  summary: string | null;
  keyInsights: string[];
}

export interface LongTermContext {
  topics: ArchivedTopicSummary[];
}

// ── MemoryManager ───────────────────────────────────────────────────────────

export class MemoryManager {
  constructor(private db: SophonDB) {}

  /**
   * Load short-term context from the active topic's message history.
   * When the thread exceeds maxMessages, keeps the first 5 messages
   * (for conversation opening context) and the last (maxMessages - 5)
   * messages (for recent context).
   */
  loadShortTerm(topicId: string, maxMessages: number = 50): ShortTermContext {
    const topic = this.db.getTopic(topicId);
    if (!topic) {
      return { topicTitle: '', messages: [], wasTrimmed: false };
    }

    const allMessages = this.db.getTopicMessages(topicId);

    if (allMessages.length <= maxMessages) {
      return {
        topicTitle: topic.title,
        messages: allMessages,
        wasTrimmed: false,
      };
    }

    // Keep first 5 messages for opening context + last (max - 5) for recency
    const headCount = 5;
    const tailCount = maxMessages - headCount;
    const head = allMessages.slice(0, headCount);
    const tail = allMessages.slice(allMessages.length - tailCount);

    return {
      topicTitle: topic.title,
      messages: [...head, ...tail],
      wasTrimmed: true,
    };
  }

  /**
   * Load long-term context from archived topics.
   * Returns summaries and parsed key insights for each archived topic.
   */
  loadLongTerm(limit: number = 5): LongTermContext {
    const archivedTopics = this.db.getTopicsByStatus('archived');
    const limited = archivedTopics.slice(0, limit);

    const topics: ArchivedTopicSummary[] = limited.map((topic) => {
      let keyInsights: string[] = [];
      if (topic.key_insights) {
        try {
          keyInsights = JSON.parse(topic.key_insights);
        } catch {
          keyInsights = [];
        }
      }

      return {
        id: topic.id,
        title: topic.title,
        summary: topic.summary,
        keyInsights,
      };
    });

    return { topics };
  }

  /**
   * Build a complete context prompt combining personality traits,
   * long-term memories, and the current topic title into markdown.
   */
  buildContextPrompt(activeTopicId: string): string {
    const sections: string[] = [];

    // ── Personality Traits ──────────────────────────────────────────────
    const traits = this.db.getAllTraits();
    if (traits.length > 0) {
      sections.push('## User Profile\n');
      const grouped = this.groupTraitsByCategory(traits);
      for (const [category, categoryTraits] of Object.entries(grouped)) {
        sections.push(`### ${category}`);
        for (const trait of categoryTraits) {
          sections.push(
            `- **${trait.key}**: ${trait.value} (confidence: ${trait.confidence})`
          );
        }
        sections.push('');
      }
    }

    // ── Long-term Memories ──────────────────────────────────────────────
    const longTerm = this.loadLongTerm();
    if (longTerm.topics.length > 0) {
      sections.push('## Previous Conversations\n');
      for (const topic of longTerm.topics) {
        sections.push(`### ${topic.title}`);
        if (topic.summary) {
          sections.push(topic.summary);
        }
        if (topic.keyInsights.length > 0) {
          sections.push('Key insights:');
          for (const insight of topic.keyInsights) {
            sections.push(`- ${insight}`);
          }
        }
        sections.push('');
      }
    }

    // ── Current Topic ───────────────────────────────────────────────────
    const activeTopic = this.db.getTopic(activeTopicId);
    if (activeTopic) {
      sections.push(`## Current Topic: ${activeTopic.title}\n`);
    }

    return sections.join('\n');
  }

  /**
   * Format messages for sending to an LLM: returns a simple
   * {role, content}[] array.
   */
  formatMessagesForLLM(topicId: string): { role: string; content: string }[] {
    const messages = this.db.getTopicMessages(topicId);
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private groupTraitsByCategory(
    traits: PersonalityTrait[]
  ): Record<string, PersonalityTrait[]> {
    const grouped: Record<string, PersonalityTrait[]> = {};
    for (const trait of traits) {
      if (!grouped[trait.category]) {
        grouped[trait.category] = [];
      }
      grouped[trait.category].push(trait);
    }
    return grouped;
  }
}
