import { describe, expect, test } from 'bun:test';
import { evaluateDeterminism, type DeterminismInput } from '../evaluateDeterminism.js';

const mockCtx = {
  logger: {
    info: () => {},
    error: () => {},
  },
  correlationId: 'test-correlation',
};

describe('evaluateDeterminism', () => {
  test('should return high score for identical responses', () => {
    const input: DeterminismInput = {
      responses: [
        {
          prompt: 'What is 2+2?',
          responses: ['4', '4', '4'],
        },
      ],
    };

    const result = evaluateDeterminism(input, mockCtx);
    expect(result.isOk()).toBe(true);

    const score = result._unsafeUnwrap();
    expect(score.type).toBe('determinism');
    expect(score.weight).toBe(20);
    expect(score.rawScore).toBeGreaterThan(3);
    expect(score.passed).toBe(true);
  });

  test('should return low score for very different responses', () => {
    const input: DeterminismInput = {
      responses: [
        {
          prompt: 'Tell me a joke',
          responses: [
            'Why did the chicken cross the road? To get to the other side!',
            'A man walks into a bar and says ouch.',
            'Knock knock. Who\'s there? Boo. Boo who? Don\'t cry!',
          ],
        },
      ],
    };

    const result = evaluateDeterminism(input, mockCtx);
    expect(result.isOk()).toBe(true);

    const score = result._unsafeUnwrap();
    expect(score.type).toBe('determinism');
    expect(score.rawScore).toBeLessThan(5);
  });

  test('should handle multiple prompts', () => {
    const input: DeterminismInput = {
      responses: [
        {
          prompt: 'What is 2+2?',
          responses: ['4', '4', '4'],
        },
        {
          prompt: 'What is the capital of France?',
          responses: ['Paris', 'Paris', 'Paris'],
        },
      ],
    };

    const result = evaluateDeterminism(input, mockCtx);
    expect(result.isOk()).toBe(true);

    const score = result._unsafeUnwrap();
    expect(score.rawScore).toBeGreaterThan(4);
  });

  test('should include reasoning with variance calculation', () => {
    const input: DeterminismInput = {
      responses: [
        {
          prompt: 'Hello',
          responses: ['Hi there!', 'Hello!', 'Hey!'],
        },
      ],
    };

    const result = evaluateDeterminism(input, mockCtx);
    const score = result._unsafeUnwrap();

    expect(score.reasoning.reasoning).toContain('variance');
    expect(score.reasoning.confidence).toBeGreaterThan(0);
    expect(score.reasoning.confidence).toBeLessThanOrEqual(1);
  });
});
