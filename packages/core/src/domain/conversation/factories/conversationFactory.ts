import type { Channel } from '../../channel/Channel';
import {
  type Conversation,
  ConversationId,
  type ConversationId as ConversationIdType,
  type ConversationStatus,
} from '../Conversation';

export interface CreateConversationInput {
  status: ConversationStatus;
  channel: Channel;
  title?: string;
  previousConversationIds?: ConversationIdType[];
}

export function createConversation(
  input: CreateConversationInput,
): Conversation {
  return {
    id: ConversationId(),
    createdAt: new Date(),
    schemaVersion: 1,
    ...input,
  };
}
