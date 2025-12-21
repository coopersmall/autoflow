import zod from 'zod';

export type ResponseFormatText = zod.infer<typeof responseFormatTextSchema>;

export const responseFormatTextSchema = zod
  .strictObject({
    type: zod.literal('text'),
  })
  .describe('Plain text response format.');
