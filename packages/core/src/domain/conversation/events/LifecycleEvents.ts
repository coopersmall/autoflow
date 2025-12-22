import zod from 'zod';

// === LIFECYCLE EVENT DATA ===

export const startEventDataSchema = zod.strictObject({
  type: zod.literal('start'),
});

export const finishEventDataSchema = zod.strictObject({
  type: zod.literal('finish'),
  finishReason: zod.enum([
    'stop',
    'length',
    'content-filter',
    'tool-calls',
    'error',
    'other',
    'unknown',
  ]),
});

export const errorEventDataSchema = zod.strictObject({
  type: zod.literal('error'),
  error: zod.unknown(),
});

export const abortEventDataSchema = zod.strictObject({
  type: zod.literal('abort'),
});
