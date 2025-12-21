import { jsonSchema } from '@core/domain/json-schema/JsonSchema';
import zod from 'zod';

export type ResponseFormatJsonSchema = zod.infer<
  typeof responseFormatJsonSchemaSchema
>;

export const responseFormatJsonSchemaSchema = zod
  .strictObject({
    type: zod.literal('json_schema'),
    name: zod.string().describe('The name of the response format.'),
    description: zod
      .string()
      .describe('A description of the expected response.'),
    schema: jsonSchema.describe('JSON Schema defining the response structure.'),
  })
  .describe('Structured JSON response format with schema validation.');
