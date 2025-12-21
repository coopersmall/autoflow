import zod from 'zod';
import { finishReasonSchema } from '../shared/FinishReason';
import { providerMetadataSchema } from '../shared/ProviderMetadata';
import { requestMetadataSchema } from '../shared/RequestMetadata';
import { responseMetadataSchema } from '../shared/ResponseMetadata';
import { usageSchema } from '../shared/Usage';
import { warningSchema } from '../shared/Warning';

export type StartPart = zod.infer<typeof startPartSchema>;
export const startPartSchema = zod.strictObject({
  type: zod.literal('start'),
});

export type StartStepPart = zod.infer<typeof startStepPartSchema>;
export const startStepPartSchema = zod.strictObject({
  type: zod.literal('start-step'),
  request: requestMetadataSchema,
  warnings: zod.array(warningSchema),
});

export type FinishStepPart = zod.infer<typeof finishStepPartSchema>;
export const finishStepPartSchema = zod.strictObject({
  type: zod.literal('finish-step'),
  response: responseMetadataSchema,
  usage: usageSchema,
  finishReason: finishReasonSchema,
  providerMetadata: providerMetadataSchema.optional(),
});

export type FinishPart = zod.infer<typeof finishPartSchema>;
export const finishPartSchema = zod.strictObject({
  type: zod.literal('finish'),
  finishReason: finishReasonSchema,
  totalUsage: usageSchema,
});

export type ErrorPart = zod.infer<typeof errorPartSchema>;
export const errorPartSchema = zod.strictObject({
  type: zod.literal('error'),
  error: zod.unknown(),
});

export type AbortPart = zod.infer<typeof abortPartSchema>;
export const abortPartSchema = zod.strictObject({
  type: zod.literal('abort'),
});

export type RawPart = zod.infer<typeof rawPartSchema>;
export const rawPartSchema = zod.strictObject({
  type: zod.literal('raw'),
  rawValue: zod.unknown(),
});
