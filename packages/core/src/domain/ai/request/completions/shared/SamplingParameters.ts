import zod from 'zod';

export type SamplingParameters = zod.infer<typeof samplingParametersSchema>;

export const topPSchema = zod
  .number()
  .min(0)
  .max(1)
  .optional()
  .describe(
    'Nucleus sampling. Only sample from tokens with cumulative probability >= topP. Recommended to set either temperature or topP, not both.',
  );

export const topKSchema = zod
  .number()
  .int()
  .positive()
  .optional()
  .describe(
    'Only sample from the top K tokens. Used to remove long tail low probability responses. Advanced use case only.',
  );

export const presencePenaltySchema = zod
  .number()
  .min(-2)
  .max(2)
  .optional()
  .describe(
    'Presence penalty (-2 to 2). Positive values penalize tokens that have already appeared, encouraging new topics.',
  );

export const frequencyPenaltySchema = zod
  .number()
  .min(-2)
  .max(2)
  .optional()
  .describe(
    'Frequency penalty (-2 to 2). Positive values penalize tokens based on frequency, reducing repetition.',
  );

export const samplingParametersSchema = zod
  .strictObject({
    topP: topPSchema,
    topK: topKSchema,
    presencePenalty: presencePenaltySchema,
    frequencyPenalty: frequencyPenaltySchema,
  })
  .describe('Advanced sampling parameters for controlling output diversity.');
