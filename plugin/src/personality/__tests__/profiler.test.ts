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
