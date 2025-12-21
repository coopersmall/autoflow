import zod from 'zod';

export type GenerationLimits = zod.infer<typeof generationLimitsSchema>;

export const maxOutputTokensSchema = zod
  .number()
  .int()
  .positive()
  .optional()
  .describe('Maximum number of tokens to generate.');

export const stopSequencesSchema = zod
  .array(zod.string())
  .optional()
  .describe(
    'Sequences that will stop generation. If the model generates any of these, it stops.',
  );

export const seedSchema = zod
  .number()
  .int()
  .optional()
  .describe(
    'Seed for random sampling. If set and supported, calls will generate deterministic results.',
  );

export const generationLimitsSchema = zod
  .strictObject({
    maxOutputTokens: maxOutputTokensSchema,
    stopSequences: stopSequencesSchema,
    seed: seedSchema,
  })
  .describe('Limits and constraints for text generation.');
