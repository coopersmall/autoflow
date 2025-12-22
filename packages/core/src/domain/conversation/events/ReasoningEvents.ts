import zod from 'zod';

// === REASONING EVENT DATA ===

export const reasoningStartEventDataSchema = zod.strictObject({
  type: zod.literal('reasoning-start'),
  id: zod.string(),
});

export const reasoningEndEventDataSchema = zod.strictObject({
  type: zod.literal('reasoning-end'),
  id: zod.string(),
});

export const reasoningDeltaEventDataSchema = zod.strictObject({
  type: zod.literal('reasoning-delta'),
  id: zod.string(),
  text: zod.string(),
});
