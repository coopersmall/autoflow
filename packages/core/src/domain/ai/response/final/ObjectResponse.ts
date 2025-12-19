import zod from 'zod';
import { finishReasonSchema } from '../shared/FinishReason';
import { providerMetadataSchema } from '../shared/ProviderMetadata';
import { requestMetadataSchema } from '../shared/RequestMetadata';
import { responseMetadataSchema } from '../shared/ResponseMetadata';
import { usageSchema } from '../shared/Usage';
import { warningSchema } from '../shared/Warning';

export type ObjectResponse<T> = {
  object: T;
  reasoning: string | undefined;
  finishReason: zod.infer<typeof finishReasonSchema>;
  usage: zod.infer<typeof usageSchema>;
  request?: zod.infer<typeof requestMetadataSchema>;
  response?: zod.infer<typeof responseMetadataSchema>;
  warnings?: zod.infer<typeof warningSchema>[];
  providerMetadata?: zod.infer<typeof providerMetadataSchema>;
};

// Schema factory for ObjectResponse with a given object schema
export const createObjectResponseSchema = <T extends zod.ZodTypeAny>(
  objectSchema: T,
) =>
  zod
    .strictObject({
      object: objectSchema.describe('The generated object.'),
      reasoning: zod
        .string()
        .optional()
        .describe('Reasoning used to generate the object.'),
      finishReason: finishReasonSchema,
      usage: usageSchema,
      request: requestMetadataSchema.optional(),
      response: responseMetadataSchema.optional(),
      warnings: zod.array(warningSchema).optional(),
      providerMetadata: providerMetadataSchema.optional(),
    })
    .describe('Final response from generateObject or streamObject.');
