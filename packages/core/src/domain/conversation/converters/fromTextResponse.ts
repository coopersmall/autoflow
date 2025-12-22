import type { FileAssetId } from '@core/domain/file';
import type { AIProvider } from '../../ai/providers/AIProviders';
import type { TextResponse } from '../../ai/response';
import type { ConversationId } from '../Conversation';
import { createAgentComplete } from '../factories';
import type { AgentItem } from '../items';
import type { Step, StepContent } from '../steps';

/**
 * Context needed to convert AI responses to ConversationItems
 */
export interface ConversionContext {
  conversationId: ConversationId;
  turnIndex: number;
  provider: AIProvider;
  model: string;
  agentId?: string;
}

/**
 * Converts a non-streaming TextResponse to an AgentItem.
 * This is used when we get a complete response without streaming.
 *
 * Since we don't have streaming events for non-streaming responses,
 * we create a single-step agent execution. The content is populated
 * directly from the TextResponse fields.
 *
 * Note: The caller is responsible for creating the AssistantMessage
 * after all agents complete.
 *
 * @param response - The complete TextResponse from the AI
 * @param context - Conversion context with conversation metadata
 * @param files - Optional file attachments for the response
 * @returns An AgentItem representing the execution
 */
export function fromTextResponse(
  response: TextResponse,
  context: ConversionContext,
  files?: Array<{
    fileId: FileAssetId;
    mediaType: string;
  }>,
): AgentItem {
  // Convert tool calls and results into our tool format
  const tools =
    response.toolCalls.length > 0 || response.toolResults.length > 0
      ? convertTools(response)
      : undefined;

  const now = new Date();

  // Build step content
  const content: StepContent = {
    text: response.text,
    reasoning: response.reasoningText,
    tools,
    sources: response.sources,
    files,
  };

  // Create a single step representing the entire response
  const step: Step = {
    stepIndex: 0,
    content,
    usage: response.usage,
    finishReason: response.finishReason,
    startedAt: now,
    finishedAt: now,
  };

  return createAgentComplete({
    conversationId: context.conversationId,
    turnIndex: context.turnIndex,
    agentId: context.agentId ?? 'default',
    provider: context.provider,
    model: context.model,
    startedAt: step.startedAt,
    finishedAt: step.finishedAt,
    steps: [step],
    totalUsage: response.usage,
    finishReason: response.finishReason,
  });
}

/**
 * Converts TextResponse tool calls and results into our tool format
 */
function convertTools(response: TextResponse) {
  const toolsMap = new Map<
    string,
    {
      toolCallId: string;
      toolName: string;
      input?: unknown;
      output?: unknown;
      isError?: boolean;
    }
  >();

  // Add all tool calls
  for (const toolCall of response.toolCalls) {
    toolsMap.set(toolCall.toolCallId, {
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      input: toolCall.input,
    });
  }

  // Add tool results
  for (const toolResult of response.toolResults) {
    const existing = toolsMap.get(toolResult.toolCallId);
    if (existing) {
      existing.output = toolResult.output;
      existing.isError = toolResult.isError;
    } else {
      toolsMap.set(toolResult.toolCallId, {
        toolCallId: toolResult.toolCallId,
        toolName: toolResult.toolName,
        input: toolResult.input,
        output: toolResult.output,
        isError: toolResult.isError,
      });
    }
  }

  return Array.from(toolsMap.values());
}
