import type { FileAssetId } from '@core/domain/file';
import type { AIProvider } from '../../ai/providers/AIProviders';
import type { FinishReason, Usage } from '../../ai/response';
import type { ConversationId } from '../Conversation';
import {
  type AgentItem,
  ConversationItemId,
  type ConversationItemId as ConversationItemIdType,
  type MessageItem,
} from '../items';
import type { ItemError } from '../items/AgentItem';
import type { Source } from '../shared/Source';
import type { Summary } from '../shared/Summary';
import type { Step } from '../steps/Step';

// ===== Shared Input Types =====

export interface BaseItemInput {
  conversationId: ConversationId;
  turnIndex: number;
  metadata?: Record<string, unknown>;
}

export interface AttachmentInput {
  fileId: FileAssetId;
  mediaType: string;
}

export interface ToolCallInput {
  toolCallId: string;
  toolName: string;
  input?: unknown;
  output?: unknown;
  isError?: boolean;
  timestamp?: Date;
}

// ===== User Message =====

export interface CreateUserMessageInput extends BaseItemInput {
  text: string;
  attachments?: AttachmentInput[];
}

export function createUserMessage(input: CreateUserMessageInput): MessageItem {
  return {
    id: ConversationItemId(),
    createdAt: new Date(),
    schemaVersion: 1,
    type: 'message',
    conversationId: input.conversationId,
    turnIndex: input.turnIndex,
    metadata: input.metadata,
    message: {
      role: 'user',
      text: input.text,
      attachments: input.attachments,
    },
  };
}

// ===== Assistant Message =====

export interface CreateAssistantMessageInput extends BaseItemInput {
  text?: string;
  attachments?: AttachmentInput[];
  rootAgentItemId: ConversationItemIdType;
  summary: Summary;
}

export function createAssistantMessage(
  input: CreateAssistantMessageInput,
): MessageItem {
  return {
    id: ConversationItemId(),
    createdAt: new Date(),
    schemaVersion: 1,
    type: 'message',
    conversationId: input.conversationId,
    turnIndex: input.turnIndex,
    metadata: input.metadata,
    message: {
      role: 'assistant',
      text: input.text,
      attachments: input.attachments,
      rootAgentItemId: input.rootAgentItemId,
      summary: input.summary,
    },
  };
}

// ===== Agent Item Base =====

export interface CreateAgentBaseInput extends BaseItemInput {
  agentId: string;
  provider: AIProvider;
  model: string;
  parentAgentItemId?: ConversationItemIdType;
  triggeredByToolCallId?: string;
  startedAt: Date;
  finishedAt: Date;
}

// ===== Agent Complete =====

export interface CreateAgentCompleteInput extends CreateAgentBaseInput {
  steps: Step[];
  totalUsage: Usage;
  finishReason: FinishReason;
}

export function createAgentComplete(
  input: CreateAgentCompleteInput,
): AgentItem {
  return {
    id: ConversationItemId(),
    createdAt: new Date(),
    schemaVersion: 1,
    type: 'agent',
    conversationId: input.conversationId,
    turnIndex: input.turnIndex,
    metadata: input.metadata,
    agentId: input.agentId,
    provider: input.provider,
    model: input.model,
    parentAgentItemId: input.parentAgentItemId,
    triggeredByToolCallId: input.triggeredByToolCallId,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    result: {
      status: 'complete',
      steps: input.steps,
      totalUsage: input.totalUsage,
      finishReason: input.finishReason,
    },
  };
}

// ===== Agent Error =====

export interface CreateAgentErrorInput extends CreateAgentBaseInput {
  steps: Step[];
  error: ItemError;
}

export function createAgentError(input: CreateAgentErrorInput): AgentItem {
  return {
    id: ConversationItemId(),
    createdAt: new Date(),
    schemaVersion: 1,
    type: 'agent',
    conversationId: input.conversationId,
    turnIndex: input.turnIndex,
    metadata: input.metadata,
    agentId: input.agentId,
    provider: input.provider,
    model: input.model,
    parentAgentItemId: input.parentAgentItemId,
    triggeredByToolCallId: input.triggeredByToolCallId,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    result: {
      status: 'error',
      steps: input.steps,
      error: input.error,
    },
  };
}

// ===== Agent Aborted =====

export interface CreateAgentAbortedInput extends CreateAgentBaseInput {
  steps: Step[];
}

export function createAgentAborted(input: CreateAgentAbortedInput): AgentItem {
  return {
    id: ConversationItemId(),
    createdAt: new Date(),
    schemaVersion: 1,
    type: 'agent',
    conversationId: input.conversationId,
    turnIndex: input.turnIndex,
    metadata: input.metadata,
    agentId: input.agentId,
    provider: input.provider,
    model: input.model,
    parentAgentItemId: input.parentAgentItemId,
    triggeredByToolCallId: input.triggeredByToolCallId,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    result: {
      status: 'aborted',
      steps: input.steps,
    },
  };
}

// ===== Re-export legacy types for backward compatibility =====
// These can be removed once consumers are migrated

/** @deprecated Use CreateUserMessageInput instead */
export type CreateUserItemInput = CreateUserMessageInput;
/** @deprecated Use createUserMessage instead */
export const createUserItem = createUserMessage;

/** @deprecated Use CreateAssistantMessageInput instead */
export interface CreateAssistantItemCompleteInput extends BaseItemInput {
  provider: AIProvider;
  model: string;
  text?: string;
  reasoning?: string;
  sources?: Source[];
  files?: AttachmentInput[];
  tools?: ToolCallInput[];
  usage: Usage;
  finishReason: FinishReason;
}
