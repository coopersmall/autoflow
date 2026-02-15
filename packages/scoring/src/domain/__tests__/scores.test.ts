import { describe, expect, test } from 'bun:test';
import {
  type ComponentScore,
  type JudgeReasoning,
  COMPONENT_WEIGHTS,
  MIN_SCORE,
  MAX_SCORE,
  calculateWeightedScore,
  normalizeToFicoScale,
  componentScoreSchema,
  judgeReasoningSchema,
} from '../scores.js';

describe('Score Constants', () => {
  test('component weights should sum to 100', () => {
    const sum = Object.values(COMPONENT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  test('score range should be FICO-style (300-850)', () => {
    expect(MIN_SCORE).toBe(300);
    expect(MAX_SCORE).toBe(850);
  });
});

describe('normalizeToFicoScale', () => {
  test('should map 1 to MIN_SCORE (300)', () => {
    expect(normalizeToFicoScale(1)).toBe(300);
  });

  test('should map 5 to MAX_SCORE (850)', () => {
    expect(normalizeToFicoScale(5)).toBe(850);
  });

  test('should map 3 to middle of range', () => {
    // 3 is midpoint of 1-5, should map to midpoint of 300-850 = 575
    expect(normalizeToFicoScale(3)).toBe(575);
  });

  test('should handle decimal values', () => {
    // 2.5 should be between 437 and 575
    const result = normalizeToFicoScale(2.5);
    expect(result).toBeGreaterThan(400);
    expect(result).toBeLessThan(600);
  });
});

describe('calculateWeightedScore', () => {
  test('should calculate weighted score correctly', () => {
    expect(calculateWeightedScore(5, 20)).toBe(1); // 5 * 20 / 100
  });

  test('should handle zero weight', () => {
    expect(calculateWeightedScore(5, 0)).toBe(0);
  });

  test('should handle 100 weight', () => {
    expect(calculateWeightedScore(3, 100)).toBe(3);
  });
});

describe('judgeReasoningSchema', () => {
  test('should validate a valid judge reasoning', () => {
    const input = {
      reasoning: 'The agent performed well',
      score: 4,
      confidence: 0.85,
      evidence: [],
    };
    const result = judgeReasoningSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  test('should reject score below 1', () => {
    const input = {
      reasoning: 'Test',
      score: 0,
      confidence: 0.5,
      evidence: [],
    };
    const result = judgeReasoningSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  test('should reject score above 5', () => {
    const input = {
      reasoning: 'Test',
      score: 6,
      confidence: 0.5,
      evidence: [],
    };
    const result = judgeReasoningSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  test('should reject confidence above 1', () => {
    const input = {
      reasoning: 'Test',
      score: 3,
      confidence: 1.5,
      evidence: [],
    };
    const result = judgeReasoningSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('componentScoreSchema', () => {
  const validReasoning: JudgeReasoning = {
    reasoning: 'Test reasoning',
    score: 4,
    confidence: 0.8,
    evidence: [],
  };

  test('should validate a valid component score', () => {
    const input = {
      type: 'determinism' as const,
      weight: 20,
      rawScore: 4,
      normalizedScore: 712,
      weightedScore: 0.8,
      reasoning: validReasoning,
      passed: true,
    };
    const result = componentScoreSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  test('should reject normalized score below MIN_SCORE', () => {
    const input = {
      type: 'determinism' as const,
      weight: 20,
      rawScore: 4,
      normalizedScore: 200,
      weightedScore: 0.8,
      reasoning: validReasoning,
      passed: true,
    };
    const result = componentScoreSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  test('should accept all component types', () => {
    const types = ['determinism', 'brandAlignment', 'grounding', 'safety', 'operationalEfficiency'] as const;
    for (const type of types) {
      const input = {
        type,
        weight: COMPONENT_WEIGHTS[type],
        rawScore: 4,
        normalizedScore: 712,
        weightedScore: calculateWeightedScore(4, COMPONENT_WEIGHTS[type]),
        reasoning: validReasoning,
        passed: true,
      };
      const result = componentScoreSchema.safeParse(input);
      expect(result.success).toBe(true);
    }
  });
});
