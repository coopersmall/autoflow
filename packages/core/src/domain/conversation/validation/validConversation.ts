import type { AppError } from '@core/errors/AppError';
import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';
import {
  type Conversation,
  type ConversationId,
  type ConversationStatus,
  conversationIdSchema,
  conversationSchema,
  conversationStatusSchema,
} from '../Conversation';

export function validConversation(
  input: unknown,
): Result<Conversation, AppError> {
  return validate(conversationSchema, input);
}

export function validConversationId(
  input: unknown,
): Result<ConversationId, AppError> {
  return validate(conversationIdSchema, input);
}

export function validConversationStatus(
  input: unknown,
): Result<ConversationStatus, AppError> {
  return validate(conversationStatusSchema, input);
}
