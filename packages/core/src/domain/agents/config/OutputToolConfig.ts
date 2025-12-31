import { z as zod } from 'zod';
import { toolSchema } from '../../ai/request/completions/tools/Tool';

export const outputToolConfigSchema = zod.strictObject({
  tool: toolSchema.describe('The tool definition for structured output'),
  validation: zod
    .strictObject({
      retryOnFailure: zod.boolean().default(true),
      maxRetries: zod.number().default(3),
    })
    .optional(),
});

export type OutputToolConfig = zod.infer<typeof outputToolConfigSchema>;
