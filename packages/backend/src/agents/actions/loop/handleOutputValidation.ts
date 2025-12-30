import type { OutputToolConfig } from '@core/domain/agents';
import type {
  AssistantMessage,
  RequestAssistantContentPart,
  TextResponse,
  UserMessage,
} from '@core/domain/ai';
import type { AppError } from '@core/errors/AppError';
import { internalError } from '@core/errors/factories';
import { validateOutputToolResult } from '../validation/validateOutputToolResult';

/**
 * Parameters for handling output tool validation.
 */
export interface HandleOutputValidationParams {
  /** The LLM response (for finding output tool call and building retry messages) */
  readonly response: TextResponse;
  /** The output tool config from the manifest */
  readonly outputToolConfig: OutputToolConfig | undefined;
  /** Current retry count */
  readonly currentRetries: number;
}

/**
 * Result of handling output validation.
 * Indicates what action the caller should take.
 */
export type HandleOutputValidationResult =
  | { action: 'continue' } // Valid or no output tool called - proceed normally
  | { action: 'retry'; retryMessages: [AssistantMessage, UserMessage] } // Invalid - caller should retry
  | { action: 'error'; error: AppError }; // Max retries or validation error

/**
 * Handles output tool validation and returns the action to take.
 *
 * For 'retry' action, includes messages the caller should add to the conversation.
 *
 * @param params - Validation parameters including response and output tool config
 * @returns Action to take: 'continue', 'retry' (with messages), or 'error'
 */
export function handleOutputValidation(
  params: HandleOutputValidationParams,
): HandleOutputValidationResult {
  const { response, outputToolConfig, currentRetries } = params;

  // No output tool configured - proceed normally
  if (!outputToolConfig) {
    return { action: 'continue' };
  }

  // Find the output tool call
  const outputToolCall = response.toolCalls?.find(
    (tc) => tc.toolName === outputToolConfig.tool.function.name,
  );

  // Output tool not called - proceed normally
  if (!outputToolCall) {
    return { action: 'continue' };
  }

  // Validate the output tool result
  const validationResult = validateOutputToolResult({
    outputToolCall,
    outputToolConfig,
    currentRetries,
  });

  if (validationResult.isErr()) {
    return { action: 'error', error: validationResult.error };
  }

  const validation = validationResult.value;

  if (validation.status === 'max_retries_exceeded') {
    return {
      action: 'error',
      error: internalError('Output tool max retries exceeded', {
        metadata: { retries: currentRetries },
      }),
    };
  }

  if (validation.status === 'invalid') {
    // Build assistant message with text, reasoning, and tool calls
    const assistantParts: RequestAssistantContentPart[] = [];

    // Add text if present
    if (response.text) {
      assistantParts.push({ type: 'text', text: response.text });
    }

    // Add reasoning if present
    for (const reasoning of response.reasoning ?? []) {
      assistantParts.push({
        type: 'reasoning',
        text: reasoning.text,
      });
    }

    // Add tool calls from the response (preserves what the LLM requested)
    for (const toolCall of response.toolCalls ?? []) {
      assistantParts.push({
        type: 'tool-call',
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        input: JSON.stringify(toolCall.input),
      });
    }

    const assistantMessage: AssistantMessage = {
      role: 'assistant',
      // Use simple string if only text, array otherwise
      content:
        assistantParts.length === 1 && assistantParts[0].type === 'text'
          ? response.text
          : assistantParts,
    };

    const retryMessage: UserMessage = {
      role: 'user',
      content: validation.errorMessage,
    };

    return {
      action: 'retry',
      retryMessages: [assistantMessage, retryMessage],
    };
  }

  // status === 'valid'
  return { action: 'continue' };
}
