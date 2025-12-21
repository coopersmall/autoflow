import zod from 'zod';

export type SystemMessage = zod.infer<typeof systemMessageSchema>;

export const systemMessageSchema = zod
  .strictObject({
    role: zod.literal('system'),
    content: zod.string().describe('The system prompt content.'),
  })
  .describe('System message that sets the behavior of the model.');
