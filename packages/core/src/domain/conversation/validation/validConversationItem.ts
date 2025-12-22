import type { AppError } from '@core/errors/AppError';
import { validationError } from '@core/errors/factories';
import { validate } from '@core/validation/validate';
import { err, ok, type Result } from 'neverthrow';
import {
  type AgentItem,
  type ConversationItem,
  type ConversationItemId,
  conversationItemIdSchema,
  conversationItemSchema,
  type MessageItem,
} from '../items';
import { agentItemSchema } from '../items/AgentItem';
import { messageItemSchema } from '../items/MessageItem';

// === Main Validators ===

export function validConversationItem(
  input: unknown,
): Result<ConversationItem, AppError> {
  return validate(conversationItemSchema, input);
}

export function validConversationItemId(
  input: unknown,
): Result<ConversationItemId, AppError> {
  return validate(conversationItemIdSchema, input);
}

// === Message Validators ===

export function validMessageItem(
  input: unknown,
): Result<MessageItem, AppError> {
  return validate(messageItemSchema, input);
}

export function validUserMessage(
  input: unknown,
): Result<MessageItem, AppError> {
  return validate(messageItemSchema, input).andThen((item) => {
    if (item.message.role !== 'user') {
      return err(validationError('Expected user message'));
    }
    return ok(item);
  });
}

export function validAssistantMessage(
  input: unknown,
): Result<MessageItem, AppError> {
  return validate(messageItemSchema, input).andThen((item) => {
    if (item.message.role !== 'assistant') {
      return err(validationError('Expected assistant message'));
    }
    return ok(item);
  });
}

// === Agent Validators ===

export function validAgentItem(input: unknown): Result<AgentItem, AppError> {
  return validate(agentItemSchema, input);
}

export function validAgentComplete(
  input: unknown,
): Result<AgentItem, AppError> {
  return validate(agentItemSchema, input).andThen((item) => {
    if (item.result.status !== 'complete') {
      return err(validationError('Expected complete agent'));
    }
    return ok(item);
  });
}

export function validAgentError(input: unknown): Result<AgentItem, AppError> {
  return validate(agentItemSchema, input).andThen((item) => {
    if (item.result.status !== 'error') {
      return err(validationError('Expected error agent'));
    }
    return ok(item);
  });
}

export function validAgentAborted(input: unknown): Result<AgentItem, AppError> {
  return validate(agentItemSchema, input).andThen((item) => {
    if (item.result.status !== 'aborted') {
      return err(validationError('Expected aborted agent'));
    }
    return ok(item);
  });
}
