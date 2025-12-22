import zod from 'zod';
import { createItemSchema } from '../../Item';
import { conversationIdSchema } from '../Conversation';
import { attachmentSchema } from '../shared/Attachment';
import { summarySchema } from '../shared/Summary';
import { conversationItemIdSchema } from './ConversationItemId';

// === BASE SCHEMA ===

const baseConversationItemSchema = createItemSchema(
  conversationItemIdSchema,
).extend({
  conversationId: conversationIdSchema.describe(
    'The ID of the conversation this item belongs to',
  ),
  turnIndex: zod
    .number()
    .int()
    .min(0)
    .describe('The turn index within the conversation'),
  metadata: zod
    .record(zod.string(), zod.unknown())
    .optional()
    .describe('Additional metadata for the conversation item'),
});

// === MESSAGE ITEM ===

// User message body
export const userMessageBodySchema = zod.strictObject({
  role: zod.literal('user'),
  text: zod.string().describe('The message text from the user'),
  attachments: zod
    .array(attachmentSchema)
    .optional()
    .describe('Attachments included with the user message'),
});

export type UserMessageBody = zod.infer<typeof userMessageBodySchema>;

// Assistant message body
export const assistantMessageBodySchema = zod.strictObject({
  role: zod.literal('assistant'),
  text: zod
    .string()
    .optional()
    .describe('The final text response to display to the user'),
  attachments: zod
    .array(attachmentSchema)
    .optional()
    .describe('Attachments included with the assistant message'),
  rootAgentItemId: conversationItemIdSchema.describe(
    'ID of the root agent item that produced this response',
  ),
  summary: summarySchema.describe(
    'Summary of the agent execution tree that produced this response',
  ),
});

export type AssistantMessageBody = zod.infer<typeof assistantMessageBodySchema>;

// Message item (discriminated by role)
export const messageItemSchema = baseConversationItemSchema.extend({
  type: zod.literal('message'),
  message: zod.discriminatedUnion('role', [
    userMessageBodySchema,
    assistantMessageBodySchema,
  ]),
});

export type MessageItem = zod.infer<typeof messageItemSchema>;
