import zod from 'zod';

export type ResponseFormatJson = zod.infer<typeof responseFormatJsonSchema>;

export const responseFormatJsonSchema = zod
  .strictObject({
    type: zod.literal('json_object'),
  })
  .describe('JSON object response format. Model will output valid JSON.');
