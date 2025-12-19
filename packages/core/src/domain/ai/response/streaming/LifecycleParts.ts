import zod from 'zod';
import { finishReasonSchema } from '../shared/FinishReason';
import { providerMetadataSchema } from '../shared/ProviderMetadata';
import { requestMetadataSchema } from '../shared/RequestMetadata';
import { responseMetadataSchema } from '../shared/ResponseMetadata';
import { usageSchema } from '../shared/Usage';
import { warningSchema } from '../shared/Warning';

export type StartPart = zod.infer<typeof startPartSchema>;
export type StartStepPart = zod.infer<typeof startStepPartSchema>;
export type FinishStepPart = zod.infer<typeof finishStepPartSchema>;
export type FinishPart = zod.infer<typeof finishPartSchema>;
export type ErrorPart = zod.infer<typeof errorPartSchema>;
export type AbortPart = zod.infer<typeof abortPartSchema>;

export const startPartSchema = zod.strictObject({
  type: zod.literal('start'),
});

export const startStepPartSchema = zod.strictObject({
  type: zod.literal('start-step'),
  request: requestMetadataSchema,
  warnings: zod.array(warningSchema),
});

export const finishStepPartSchema = zod.strictObject({
  type: zod.literal('finish-step'),
  response: responseMetadataSchema,
  usage: usageSchema,
  finishReason: finishReasonSchema,
  isContinued: zod.boolean().describe('Whether the step will continue.'),
  providerMetadata: providerMetadataSchema.optional(),
});

export const finishPartSchema = zod.strictObject({
  type: zod.literal('finish'),
  finishReason: finishReasonSchema,
  totalUsage: usageSchema,
});

export const errorPartSchema = zod.strictObject({
  type: zod.literal('error'),
  error: zod.unknown().describe('The error that occurred.'),
});

export const abortPartSchema = zod.strictObject({
  type: zod.literal('abort'),
});
