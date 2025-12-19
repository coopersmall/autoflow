import zod from 'zod';
import { standardCompletionsRequestSchema } from './StandardCompletionsRequest';
import { structuredCompletionsRequestSchema } from './StructuredCompletionsRequest';

export type CompletionsRequest = zod.infer<typeof completionsRequestSchema>;

export const completionsRequestSchema = zod
  .union([standardCompletionsRequestSchema, structuredCompletionsRequestSchema])
  .describe('A completions request, either standard or structured.');
