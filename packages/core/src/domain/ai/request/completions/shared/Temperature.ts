import zod from 'zod';

export type Temperature = zod.infer<typeof temperatureSchema>;

export const temperatureSchema = zod
  .number()
  .min(0)
  .max(2)
  .optional()
  .describe(
    'Sampling temperature (0-2). Higher values like 0.8 produce more random output, lower values like 0.2 are more focused and deterministic.',
  );
