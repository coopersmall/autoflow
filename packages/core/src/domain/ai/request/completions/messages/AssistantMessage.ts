import zod from 'zod';
import { requestAssistantContentPartSchema } from '../content/ContentPart';

export type AssistantMessage = zod.infer<typeof assistantMessageSchema>;

export const assistantMessageSchema = zod
  .strictObject({
    role: zod.literal('assistant'),
    content: zod
      .union([zod.string(), zod.array(requestAssistantContentPartSchema)])
      .describe(
        'The assistant message content. Can be a string or array of content parts.',
      ),
  })
  .describe('Assistant message in a conversation.');
