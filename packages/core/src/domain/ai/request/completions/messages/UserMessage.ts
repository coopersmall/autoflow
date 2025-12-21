import zod from 'zod';
import { requestUserContentPartSchema } from '../content/ContentPart';

export type UserMessage = zod.infer<typeof userMessageSchema>;

export const userMessageSchema = zod
  .strictObject({
    role: zod.literal('user'),
    content: zod
      .union([zod.string(), zod.array(requestUserContentPartSchema)])
      .describe(
        'The user message content. Can be a string or array of content parts.',
      ),
  })
  .describe('User message in a conversation.');
