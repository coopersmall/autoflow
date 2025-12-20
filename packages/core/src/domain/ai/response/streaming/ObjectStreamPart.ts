import zod from 'zod';
import { finishReasonSchema } from '../shared/FinishReason';
import { providerMetadataSchema } from '../shared/ProviderMetadata';
import { responseMetadataSchema } from '../shared/ResponseMetadata';
import { usageSchema } from '../shared/Usage';

export type ObjectTextDeltaPart = zod.infer<typeof objectTextDeltaPartSchema>;
export type ObjectErrorPart = zod.infer<typeof objectErrorPartSchema>;
export type ObjectFinishPart = zod.infer<typeof objectFinishPartSchema>;
export type ObjectStreamPart = zod.infer<typeof objectStreamPartSchema>;

export const objectPartSchema = zod.strictObject({
  type: zod.literal('object'),
  object: zod.unknown().describe('The partial object.'),
});

export const objectTextDeltaPartSchema = zod.strictObject({
  type: zod.literal('text-delta'),
  textDelta: zod.string().describe('The text delta of the JSON.'),
});

export const objectErrorPartSchema = zod.strictObject({
  type: zod.literal('error'),
  error: zod.unknown().describe('The error that occurred.'),
});

export const objectFinishPartSchema = zod.strictObject({
  type: zod.literal('finish'),
  finishReason: finishReasonSchema,
  usage: usageSchema,
  response: responseMetadataSchema,
  providerMetadata: providerMetadataSchema.optional(),
});

export const objectStreamPartSchema = zod.discriminatedUnion('type', [
  objectPartSchema,
  objectTextDeltaPartSchema,
  objectErrorPartSchema,
  objectFinishPartSchema,
]);
