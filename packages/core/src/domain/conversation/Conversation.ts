import zod from 'zod';
import { channelSchema } from '../channel/Channel';
import { createIdSchema, newId } from '../Id';
import { createItemSchema } from '../Item';

export type ConversationId = zod.infer<typeof conversationIdSchema>;
export const ConversationId = newId<ConversationId>;
export const conversationIdSchema = createIdSchema('ConversationId');

export const conversationStatusSchema = zod.enum([
  'active',
  'reopened',
  'closed',
]);
export type ConversationStatus = zod.infer<typeof conversationStatusSchema>;

export type Conversation = zod.infer<typeof conversationSchema>;
export const conversationSchema = createItemSchema(conversationIdSchema).extend(
  {
    status: conversationStatusSchema.describe('the status of the conversation'),
    channel: channelSchema.describe(
      'the communication channel of the conversation',
    ),
    title: zod
      .string()
      .min(1)
      .optional()
      .describe('the title of the conversation'),
    previousConversationIds: zod
      .array(conversationIdSchema)
      .optional()
      .describe(
        'the IDs of previous conversations linked to this conversation',
      ),
  },
);
