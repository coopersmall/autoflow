import { describe, expect, it, mock } from 'bun:test';
import {
  generateMousePath,
  generateStepDelay,
  generateTypingDelays,
  normalRandom,
} from '@shopper/actions/humanBehavior';

describe('normalRandom', () => {
  it('should return a value within the specified range', () => {
    for (let i = 0; i < 100; i++) {
      const value = normalRandom(50, 150);
      expect(value).toBeGreaterThanOrEqual(50);
      expect(value).toBeLessThanOrEqual(150);
    }
  });

  it('should return an integer', () => {
    for (let i = 0; i < 50; i++) {
      const value = normalRandom(10, 100);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('should tend toward the center of the range', () => {
    const values: number[] = [];
    for (let i = 0; i < 1000; i++) {
      values.push(normalRandom(0, 100));
    }
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    expect(avg).toBeGreaterThan(35);
    expect(avg).toBeLessThan(65);
  });

  it('should handle equal min and max', () => {
    const value = normalRandom(50, 50);
    expect(value).toBe(50);
  });
});

describe('generateTypingDelays', () => {
  it('should return an array with one delay per character', () => {
    const delays = generateTypingDelays('hello', 50, 150);
    expect(delays.length).toBe(5);
  });

  it('should return empty array for empty string', () => {
    const delays = generateTypingDelays('', 50, 150);
    expect(delays.length).toBe(0);
  });

  it('should return delays within the specified range', () => {
    const delays = generateTypingDelays('test message', 50, 150);
    for (const delay of delays) {
      expect(delay).toBeGreaterThanOrEqual(50);
      expect(delay).toBeLessThanOrEqual(150);
    }
  });

  it('should return a readonly array', () => {
    const delays = generateTypingDelays('hi', 50, 150);
    expect(Array.isArray(delays)).toBe(true);
  });

  it('should call logger when context is provided', () => {
    const debugFn = mock();
    const ctx = { logger: { debug: debugFn } };

    generateTypingDelays('hello', 50, 150, ctx);

    expect(debugFn).toHaveBeenCalledWith('Generated typing delays', {
      charCount: 5,
      avgMs: expect.any(Number),
    });
  });

  it('should work without context', () => {
    expect(() => generateTypingDelays('hello', 50, 150)).not.toThrow();
  });
});

describe('generateStepDelay', () => {
  it('should return a value within the specified range', () => {
    for (let i = 0; i < 50; i++) {
      const delay = generateStepDelay(1000, 5000);
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThanOrEqual(5000);
    }
  });

  it('should return an integer', () => {
    const delay = generateStepDelay(1000, 5000);
    expect(Number.isInteger(delay)).toBe(true);
  });
});

describe('generateMousePath', () => {
  it('should return the specified number of points', () => {
    const path = generateMousePath(0, 0, 100, 100, 10);
    expect(path.length).toBe(10);
  });

  it('should start at the start point', () => {
    const path = generateMousePath(0, 0, 100, 100, 10);
    expect(path[0].x).toBe(0);
    expect(path[0].y).toBe(0);
  });

  it('should end at the end point', () => {
    const path = generateMousePath(0, 0, 100, 100, 10);
    const last = path[path.length - 1];
    expect(last.x).toBe(100);
    expect(last.y).toBe(100);
  });

  it('should return a single point when steps < 2', () => {
    const path = generateMousePath(0, 0, 100, 100, 1);
    expect(path.length).toBe(1);
    expect(path[0].x).toBe(100);
    expect(path[0].y).toBe(100);
  });

  it('should return integer coordinates', () => {
    const path = generateMousePath(0, 0, 100, 100, 20);
    for (const point of path) {
      expect(Number.isInteger(point.x)).toBe(true);
      expect(Number.isInteger(point.y)).toBe(true);
    }
  });

  it('should generate a path with intermediate points between start and end', () => {
    const path = generateMousePath(0, 0, 200, 200, 5);
    expect(path.length).toBe(5);
    for (const point of path) {
      expect(typeof point.x).toBe('number');
      expect(typeof point.y).toBe('number');
    }
  });

  it('should handle zero-length path (same start and end)', () => {
    const path = generateMousePath(50, 50, 50, 50, 5);
    expect(path.length).toBe(5);
    expect(path[0].x).toBe(50);
    expect(path[0].y).toBe(50);
    expect(path[path.length - 1].x).toBe(50);
    expect(path[path.length - 1].y).toBe(50);
  });
});
