import zod from 'zod';

// === TEXT EVENT DATA ===

export const textStartEventDataSchema = zod.strictObject({
  type: zod.literal('text-start'),
  id: zod.string(),
});

export const textEndEventDataSchema = zod.strictObject({
  type: zod.literal('text-end'),
  id: zod.string(),
});

export const textDeltaEventDataSchema = zod.strictObject({
  type: zod.literal('text-delta'),
  id: zod.string(),
  text: zod.string(),
});
