import { SophonDB, PersonalityTrait } from '../db/database.js';
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

  /**
   * Formats all traits grouped by category with confidence percentages.
   */
  formatProfile(): string {
    const allTraits = this.db.getAllTraits();

    if (allTraits.length === 0) {
      return 'No personality traits recorded yet.';
    }

    // Group traits by category
    const grouped: Record<string, PersonalityTrait[]> = {};
    for (const trait of allTraits) {
      if (!grouped[trait.category]) {
        grouped[trait.category] = [];
      }
      grouped[trait.category].push(trait);
    }

    const lines: string[] = ['== Personality Profile ==', ''];

    for (const [category, traits] of Object.entries(grouped)) {
      lines.push(`[${category}]`);
      for (const trait of traits) {
        const pct = Math.round(trait.confidence * 100);
        lines.push(`  - ${trait.key} (${pct}%): ${trait.value}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Builds a prompt for Claude to extract personality traits from a conversation.
   */
  buildExtractionPrompt(messages: { role: string; content: string }[]): string {
    const conversationText = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    return [
      EXTRACTION_SYSTEM_PROMPT,
      '',
      '--- Conversation ---',
      conversationText,
      '',
      'Analyze this conversation for personality-relevant signals and return the JSON extraction.',
    ].join('\n');
  }

  /**
   * Parses a JSON extraction result and updates the database.
   * For existing traits, confidence_delta is added to the current confidence (capped at 1.0).
   * For new traits, confidence starts at the confidence_delta value.
   */
  applyExtraction(jsonResult: string, messageIds: string[]): void {
    const parsed: ExtractionResult = JSON.parse(jsonResult);

    for (const obs of parsed.observations) {
      // Look up existing trait
      const existing = this.db
        .getTraitsByCategory(obs.category)
        .find((t) => t.key === obs.key);

      let newConfidence: number;
      if (existing) {
        newConfidence = Math.min(1.0, existing.confidence + obs.confidence_delta);
      } else {
        newConfidence = Math.min(1.0, obs.confidence_delta);
      }

      this.db.upsertTrait(obs.category, obs.key, obs.value, newConfidence, messageIds);
    }
  }

  /**
   * Builds a reflection prompt combining the current profile with the reflection system prompt.
   */
  buildReflectionPrompt(): string {
    const profile = this.formatProfile();

    return [
      REFLECTION_SYSTEM_PROMPT,
      '',
      '--- Current Profile ---',
      profile,
      '',
      'Write a personal reflection based on this profile.',
    ].join('\n');
  }

  /**
   * Returns true every 20 messages as a proxy for ~10 conversation exchanges.
   */
  shouldReflect(): boolean {
    const count = this.db.getMessageCount();
    return count > 0 && count % 20 === 0;
  }
}
