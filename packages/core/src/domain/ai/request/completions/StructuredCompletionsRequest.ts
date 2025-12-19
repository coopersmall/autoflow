import type zod from 'zod';
import { responseFormatSchema } from '../format/ResponseFormat';
import { baseCompletionsRequestSchema } from './BaseCompletionsRequest';

export type StructuredCompletionsRequest = zod.infer<
  typeof structuredCompletionsRequestSchema
>;

export const structuredCompletionsRequestSchema = baseCompletionsRequestSchema
  .extend({
    responseFormat: responseFormatSchema.describe(
      'The response format specification for structured output.',
    ),
  })
  .describe('Structured completions request with response format.');
