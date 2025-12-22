import zod from 'zod';

// === STEP LIFECYCLE EVENT DATA ===

export const stepStartEventDataSchema = zod.strictObject({
  type: zod.literal('step-start'),
  stepIndex: zod.number().int().min(0).describe('Zero-based index of the step'),
});

export type StepStartEventData = zod.infer<typeof stepStartEventDataSchema>;

export const stepFinishEventDataSchema = zod.strictObject({
  type: zod.literal('step-finish'),
  stepIndex: zod.number().int().min(0).describe('Zero-based index of the step'),
  usage: zod.strictObject({
    inputTokens: zod.number().int().nonnegative().optional(),
    outputTokens: zod.number().int().nonnegative().optional(),
    totalTokens: zod.number().int().nonnegative().optional(),
    reasoningTokens: zod.number().int().nonnegative().optional(),
    cachedInputTokens: zod.number().int().nonnegative().optional(),
  }),
  finishReason: zod.enum([
    'stop',
    'length',
    'content-filter',
    'tool-calls',
    'error',
    'other',
    'unknown',
  ]),
  isContinued: zod
    .boolean()
    .optional()
    .describe('Whether this step continues in another step'),
});

export type StepFinishEventData = zod.infer<typeof stepFinishEventDataSchema>;
