import type zod from 'zod';
import { baseCompletionsRequestSchema } from './BaseCompletionsRequest';
import { responseFormatJsonSchemaSchema } from './format';

export type StructuredCompletionsRequest = zod.infer<
  typeof structuredCompletionsRequestSchema
>;

export const structuredCompletionsRequestSchema = baseCompletionsRequestSchema
  .extend({
    responseFormat: responseFormatJsonSchemaSchema.describe(
      'The response format specification for structured output.',
    ),
  })
  .describe('Structured completions request with response format.');
