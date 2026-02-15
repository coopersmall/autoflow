import { describe, expect, test } from 'bun:test';
import {
  calculateCompositeScore,
  type CalculateCompositeInput,
} from '../calculateComposite.js';
import {
  type ComponentScore,
  type JudgeReasoning,
  COMPONENT_WEIGHTS,
} from '../../domain/scores.js';

// Helper to create a mock component score
function createMockComponentScore(
  type: ComponentScore['type'],
  rawScore: number,
): ComponentScore {
  const weight = COMPONENT_WEIGHTS[type];
  return {
    type,
    weight,
    rawScore,
    normalizedScore: Math.round(300 + ((rawScore - 1) / 4) * 550),
    weightedScore: (rawScore * weight) / 100,
    reasoning: {
      reasoning: 'Test reasoning',
      score: rawScore,
      confidence: 0.8,
      evidence: [],
    } as JudgeReasoning,
    passed: rawScore >= 3,
  };
}

describe('calculateCompositeScore', () => {
  test('should calculate composite score with all components', () => {
    const input: CalculateCompositeInput = {
      components: [
        createMockComponentScore('determinism', 4),
        createMockComponentScore('brandAlignment', 4),
        createMockComponentScore('grounding', 4),
        createMockComponentScore('safety', 4),
        createMockComponentScore('operationalEfficiency', 4),
      ],
    };

    const result = calculateCompositeScore(input);
    expect(result.isOk()).toBe(true);

    const score = result._unsafeUnwrap();
    expect(score.overallScore).toBe(713); // Normalized 4 (712.5 rounds to 713)
    expect(score.components).toHaveLength(5);
    expect(score.schemaVersion).toBe('1.0.0');
  });

  test('should return error when components are missing', () => {
    const input: CalculateCompositeInput = {
      components: [
        createMockComponentScore('determinism', 4),
        createMockComponentScore('safety', 4),
      ],
    };

    const result = calculateCompositeScore(input);
    expect(result.isErr()).toBe(true);
    
    const error = result._unsafeUnwrapErr();
    expect(error.message).toContain('Missing required component scores');
  });

  test('should return error when weights do not sum to 100', () => {
    const input: CalculateCompositeInput = {
      components: [
        { ...createMockComponentScore('determinism', 4), weight: 10 },
        { ...createMockComponentScore('brandAlignment', 4), weight: 10 },
        { ...createMockComponentScore('grounding', 4), weight: 10 },
        { ...createMockComponentScore('safety', 4), weight: 10 },
        { ...createMockComponentScore('operationalEfficiency', 4), weight: 10 },
      ],
    };

    const result = calculateCompositeScore(input);
    expect(result.isErr()).toBe(true);
    
    const error = result._unsafeUnwrapErr();
    expect(error.message).toContain('must sum to 100');
  });

  test('should handle perfect score (all 5s)', () => {
    const input: CalculateCompositeInput = {
      components: [
        createMockComponentScore('determinism', 5),
        createMockComponentScore('brandAlignment', 5),
        createMockComponentScore('grounding', 5),
        createMockComponentScore('safety', 5),
        createMockComponentScore('operationalEfficiency', 5),
      ],
    };

    const result = calculateCompositeScore(input);
    expect(result.isOk()).toBe(true);

    const score = result._unsafeUnwrap();
    expect(score.overallScore).toBe(850); // Max score
  });

  test('should handle minimum score (all 1s)', () => {
    const input: CalculateCompositeInput = {
      components: [
        createMockComponentScore('determinism', 1),
        createMockComponentScore('brandAlignment', 1),
        createMockComponentScore('grounding', 1),
        createMockComponentScore('safety', 1),
        createMockComponentScore('operationalEfficiency', 1),
      ],
    };

    const result = calculateCompositeScore(input);
    expect(result.isOk()).toBe(true);

    const score = result._unsafeUnwrap();
    expect(score.overallScore).toBe(300); // Min score
  });

  test('should generate unique IDs for each calculation', () => {
    const input: CalculateCompositeInput = {
      components: [
        createMockComponentScore('determinism', 4),
        createMockComponentScore('brandAlignment', 4),
        createMockComponentScore('grounding', 4),
        createMockComponentScore('safety', 4),
        createMockComponentScore('operationalEfficiency', 4),
      ],
    };

    const result1 = calculateCompositeScore(input);
    const result2 = calculateCompositeScore(input);

    expect(result1.isOk()).toBe(true);
    expect(result2.isOk()).toBe(true);

    const score1 = result1._unsafeUnwrap();
    const score2 = result2._unsafeUnwrap();

    expect(score1.id).not.toBe(score2.id);
  });
});
