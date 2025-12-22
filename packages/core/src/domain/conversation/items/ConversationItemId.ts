import type zod from 'zod';
import { createIdSchema, newId } from '../../Id';

// === CONVERSATION ITEM ID ===

export type ConversationItemId = zod.infer<typeof conversationItemIdSchema>;
export const ConversationItemId = newId<ConversationItemId>;
export const conversationItemIdSchema = createIdSchema('ConversationItemId');
