import zod from 'zod';

export type RequestReasoningPart = zod.infer<typeof requestReasoningPartSchema>;

export const requestReasoningPartSchema = zod
  .strictObject({
    type: zod.literal('reasoning'),
    text: zod.string().describe('The reasoning text.'),
  })
  .describe('Reasoning content part in an assistant message.');
