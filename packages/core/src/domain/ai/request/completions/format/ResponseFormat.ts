import zod from 'zod';
import { responseFormatJsonSchema } from './ResponseFormatJson';
import { responseFormatJsonSchemaSchema } from './ResponseFormatJsonSchema';
import { responseFormatTextSchema } from './ResponseFormatText';

export type ResponseFormat = zod.infer<typeof responseFormatSchema>;

export const responseFormatSchema = zod
  .discriminatedUnion('type', [
    responseFormatTextSchema,
    responseFormatJsonSchema,
    responseFormatJsonSchemaSchema,
  ])
  .describe('Response format specification.');
