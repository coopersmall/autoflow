import zod from 'zod';

export type FinishReason = zod.infer<typeof finishReasonSchema>;

export const finishReasonSchema = zod
  .enum([
    'stop',
    'length',
    'content-filter',
    'tool-calls',
    'error',
    'other',
    'unknown',
  ])
  .describe('The reason the model stopped generating.');
