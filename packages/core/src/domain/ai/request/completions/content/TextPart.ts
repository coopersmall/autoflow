import zod from 'zod';

export type RequestTextPart = zod.infer<typeof requestTextPartSchema>;

export const requestTextPartSchema = zod
  .strictObject({
    type: zod.literal('text'),
    text: zod.string().describe('The text content.'),
  })
  .describe('Text content part in a message.');
