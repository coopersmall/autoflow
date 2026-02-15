import { describe, expect, test } from 'bun:test';
import {
  evaluateOperationalEfficiency,
  type OperationalEfficiencyInput,
} from '../evaluateOperationalEfficiency.js';

const mockCtx = {
  logger: {
    info: () => {},
    error: () => {},
  },
  correlationId: 'test-correlation',
};

describe('evaluateOperationalEfficiency', () => {
  test('should return high score for efficient sessions', () => {
    const input: OperationalEfficiencyInput = {
      sessions: [
        { turnCount: 2, durationMs: 30000, resolvedIssue: true },
        { turnCount: 3, durationMs: 45000, resolvedIssue: true },
        { turnCount: 2, durationMs: 25000, resolvedIssue: true },
      ],
      benchmarkTurnCount: 3,
      benchmarkDurationMs: 60000,
    };

    const result = evaluateOperationalEfficiency(input, mockCtx);
    expect(result.isOk()).toBe(true);

    const score = result._unsafeUnwrap();
    expect(score.type).toBe('operationalEfficiency');
    expect(score.weight).toBe(10);
    expect(score.rawScore).toBeGreaterThan(3);
    expect(score.passed).toBe(true);
  });

  test('should return low score for inefficient sessions', () => {
    const input: OperationalEfficiencyInput = {
      sessions: [
        { turnCount: 10, durationMs: 300000, resolvedIssue: false },
        { turnCount: 12, durationMs: 350000, resolvedIssue: false },
        { turnCount: 8, durationMs: 250000, resolvedIssue: false },
      ],
      benchmarkTurnCount: 3,
      benchmarkDurationMs: 60000,
    };

    const result = evaluateOperationalEfficiency(input, mockCtx);
    expect(result.isOk()).toBe(true);

    const score = result._unsafeUnwrap();
    expect(score.rawScore).toBeLessThan(3);
    expect(score.passed).toBe(false);
  });

  test('should weight resolution rate heavily', () => {
    const input: OperationalEfficiencyInput = {
      sessions: [
        { turnCount: 3, durationMs: 60000, resolvedIssue: false },
        { turnCount: 3, durationMs: 60000, resolvedIssue: false },
        { turnCount: 3, durationMs: 60000, resolvedIssue: false },
      ],
      benchmarkTurnCount: 3,
      benchmarkDurationMs: 60000,
    };

    const result = evaluateOperationalEfficiency(input, mockCtx);
    const score = result._unsafeUnwrap();

    // Even with good turn/duration, low resolution = low score
    // With 0% resolution (40% weight) and perfect turn/duration (30% each):
    // score = 5*0.3 + 5*0.3 + 1*0.4 = 3.4 → rounds to 3
    expect(score.rawScore).toBeLessThanOrEqual(3);
  });

  test('should include efficiency metrics in evidence', () => {
    const input: OperationalEfficiencyInput = {
      sessions: [
        { turnCount: 2, durationMs: 30000, resolvedIssue: true },
      ],
      benchmarkTurnCount: 3,
      benchmarkDurationMs: 60000,
    };

    const result = evaluateOperationalEfficiency(input, mockCtx);
    const score = result._unsafeUnwrap();

    expect(score.reasoning.evidence).toHaveLength(3);
    const evidenceContent = score.reasoning.evidence.map((e) => e.content);
    expect(evidenceContent.some((c) => c.includes('turns'))).toBe(true);
    expect(evidenceContent.some((c) => c.includes('duration'))).toBe(true);
    expect(evidenceContent.some((c) => c.includes('resolution'))).toBe(true);
  });

  test('should use default benchmarks if not specified', () => {
    const input: OperationalEfficiencyInput = {
      sessions: [
        { turnCount: 3, durationMs: 60000, resolvedIssue: true },
      ],
    };

    const result = evaluateOperationalEfficiency(input, mockCtx);
    expect(result.isOk()).toBe(true);

    const score = result._unsafeUnwrap();
    expect(score.rawScore).toBeGreaterThan(3);
  });
});
