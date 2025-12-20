import type { ResponseFormatJsonSchema } from '@autoflow/core';
import { jsonSchema, type Schema } from 'ai';

export function convertResponseSchema(
  responseSchema: ResponseFormatJsonSchema,
): Schema {
  return jsonSchema(responseSchema.schema);
}
