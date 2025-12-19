import zod from 'zod';
import { assistantMessageSchema } from './AssistantMessage';
import { systemMessageSchema } from './SystemMessage';
import { toolMessageSchema } from './ToolMessage';
import { userMessageSchema } from './UserMessage';

export type Message = zod.infer<typeof messageSchema>;

export const messageSchema = zod
  .discriminatedUnion('role', [
    systemMessageSchema,
    userMessageSchema,
    assistantMessageSchema,
    toolMessageSchema,
  ])
  .describe('A message in a conversation.');
