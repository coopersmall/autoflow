import zod from 'zod';
import { createIdSchema, newId } from '../../Id';
import type {
  AgentAbortedResult,
  AgentCompleteResult,
  AgentErrorResult,
  AgentItem,
} from './AgentItem';
import { agentItemSchema } from './AgentItem';
import type {
  AssistantMessageBody,
  MessageItem,
  UserMessageBody,
} from './MessageItem';
import { messageItemSchema } from './MessageItem';

// === CONVERSATION ITEM ID ===

export type ConversationItemId = zod.infer<typeof conversationItemIdSchema>;
export const ConversationItemId = newId<ConversationItemId>;
export const conversationItemIdSchema = createIdSchema('ConversationItemId');

// === CONVERSATION ITEM UNION ===

export const conversationItemSchema = zod.discriminatedUnion('type', [
  messageItemSchema,
  agentItemSchema,
]);

export type ConversationItem = zod.infer<typeof conversationItemSchema>;

// === TYPE GUARDS ===

export function isMessageItem(item: ConversationItem): item is MessageItem {
  return item.type === 'message';
}

export function isAgentItem(item: ConversationItem): item is AgentItem {
  return item.type === 'agent';
}

export function isUserMessage(
  item: ConversationItem,
): item is MessageItem & { message: UserMessageBody } {
  return item.type === 'message' && item.message.role === 'user';
}

export function isAssistantMessage(
  item: ConversationItem,
): item is MessageItem & { message: AssistantMessageBody } {
  return item.type === 'message' && item.message.role === 'assistant';
}

export function isAgentComplete(
  item: ConversationItem,
): item is AgentItem & { result: AgentCompleteResult } {
  return item.type === 'agent' && item.result.status === 'complete';
}

export function isAgentError(
  item: ConversationItem,
): item is AgentItem & { result: AgentErrorResult } {
  return item.type === 'agent' && item.result.status === 'error';
}

export function isAgentAborted(
  item: ConversationItem,
): item is AgentItem & { result: AgentAbortedResult } {
  return item.type === 'agent' && item.result.status === 'aborted';
}
