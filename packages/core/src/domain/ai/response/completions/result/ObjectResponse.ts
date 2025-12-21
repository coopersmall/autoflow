import zod from 'zod';
import { finishReasonSchema } from '../shared/FinishReason';
import { providerMetadataSchema } from '../shared/ProviderMetadata';
import { requestMetadataSchema } from '../shared/RequestMetadata';
import { responseMetadataSchema } from '../shared/ResponseMetadata';
import { usageSchema } from '../shared/Usage';
import { warningSchema } from '../shared/Warning';

export type ObjectResponse = zod.infer<typeof objectResponseSchema>;

export const objectResponseSchema = zod
  .strictObject({
    object: zod.unknown().describe('The generated object.'),
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
