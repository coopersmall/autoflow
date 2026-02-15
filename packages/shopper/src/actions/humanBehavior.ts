export interface HumanBehaviorContext {
  readonly logger?: {
    debug(message: string, data?: Record<string, unknown>): void;
  };
}

/**
 * Generates a random number from a normal distribution using the Box-Muller transform.
 * The result is clamped to [min, max].
 */
export function normalRandom(min: number, max: number): number {
  const mean = (min + max) / 2;
  const stdDev = (max - min) / 6;

  let u1 = Math.random();
  let u2 = Math.random();
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();

  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  const value = mean + z * stdDev;

  return Math.max(min, Math.min(max, Math.round(value)));
}

/**
 * Generates an array of per-character typing delays in milliseconds,
 * using a normal distribution to simulate human-like typing.
 */
export function generateTypingDelays(
  text: string,
  minMs: number,
  maxMs: number,
  ctx?: HumanBehaviorContext,
): readonly number[] {
  const delays = Array.from({ length: text.length }, () =>
    normalRandom(minMs, maxMs),
  );

  ctx?.logger?.debug('Generated typing delays', {
    charCount: text.length,
    avgMs:
      delays.length > 0
        ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length)
        : 0,
  });

  return delays;
}

/**
 * Generates a random delay between steps using a normal distribution.
 */
export function generateStepDelay(minMs: number, maxMs: number): number {
  return normalRandom(minMs, maxMs);
}

/**
 * Generates a series of intermediate points for a natural-looking mouse
 * movement from (startX, startY) to (endX, endY) using a Bézier-style curve
 * with randomized control points.
 */
export function generateMousePath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  steps: number,
): ReadonlyArray<Readonly<{ x: number; y: number }>> {
  if (steps < 2) {
    return [{ x: endX, y: endY }];
  }

  const dx = endX - startX;
  const dy = endY - startY;

  const cp1x = startX + dx * 0.25 + normalRandom(-30, 30);
  const cp1y = startY + dy * 0.25 + normalRandom(-30, 30);
  const cp2x = startX + dx * 0.75 + normalRandom(-30, 30);
  const cp2y = startY + dy * 0.75 + normalRandom(-30, 30);

  const points: Array<Readonly<{ x: number; y: number }>> = [];

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const mt = 1 - t;

    const x =
      mt * mt * mt * startX +
      3 * mt * mt * t * cp1x +
      3 * mt * t * t * cp2x +
      t * t * t * endX;
    const y =
      mt * mt * mt * startY +
      3 * mt * mt * t * cp1y +
      3 * mt * t * t * cp2y +
      t * t * t * endY;

    points.push({ x: Math.round(x), y: Math.round(y) });
  }

  return points;
}
