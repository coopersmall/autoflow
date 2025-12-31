import type {
  AgentEvent,
  AgentToolResult,
  AgentToolResultError,
  RetryMiddlewareConfig,
} from '@core/domain/agents';
import type {
  StreamingToolExecutionMiddleware,
  ToolExecutionMiddleware,
} from '@core/domain/agents/tools';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';
import type { MiddlewareFactoryDeps } from './types';

/**
 * Determines if a failed tool result should be retried.
 *
 * Checks:
 * 1. Result must have `retryable: true`
 * 2. If `retryableErrors` is specified, error code must match
 * 3. Current attempt must be less than maxRetries
 */
function shouldRetry(
  result: AgentToolResultError,
  config: RetryMiddlewareConfig,
  attempt: number,
): boolean {
  // Must be marked as retryable by the tool
  if (result.retryable !== true) {
    return false;
  }

  // Check attempt limit
  if (attempt >= config.maxRetries) {
    return false;
  }

  // If retryableErrors filter is specified, check if code matches
  if (config.retryableErrors && config.retryableErrors.length > 0) {
    return (
      result.code !== undefined && config.retryableErrors.includes(result.code)
    );
  }

  // No filter specified - retry any retryable error
  return true;
}

/**
 * Creates streaming retry middleware.
 *
 * Retries failed tool executions based on configuration. For streaming tools,
 * events from failed attempts are discarded - only events from the final
 * (successful or last retry) attempt are yielded.
 *
 * Only retries errors where `result.retryable === true`. If `retryableErrors`
 * is specified, also checks that the error code matches.
 */
export function createStreamingRetryMiddleware(
  config: RetryMiddlewareConfig,
  deps: MiddlewareFactoryDeps,
): StreamingToolExecutionMiddleware {
  return (next) =>
    async function* (tool, toolCall, execCtx) {
      let attempt = 0;
      let lastResult: AgentToolResult;

      while (true) {
        attempt++;
        const events: Result<AgentEvent, AppError>[] = [];

        // Execute and collect events
        const generator = next(tool, toolCall, execCtx);
        let iterResult = await generator.next();

        while (!iterResult.done) {
          events.push(iterResult.value);
          iterResult = await generator.next();
        }

        lastResult = iterResult.value;

        // Check if we should retry
        if (
          lastResult.type === 'error' &&
          shouldRetry(lastResult, config, attempt)
        ) {
          deps.logger.debug('Retrying tool execution', {
            toolName: toolCall.toolName,
            attempt,
            maxRetries: config.maxRetries,
            errorCode: lastResult.code,
            error: lastResult.error,
          });
          // Discard events from failed attempt and retry
          continue;
        }

        // Success, non-retryable error, or max retries reached
        // Yield all collected events
        for (const event of events) {
          yield event;
        }

        if (lastResult.type === 'error' && attempt > 1) {
          deps.logger.debug('Tool execution failed after retries', {
            toolName: toolCall.toolName,
            attempts: attempt,
            errorCode: lastResult.code,
            error: lastResult.error,
          });
        }

        return lastResult;
      }
    };
}

/**
 * Creates non-streaming retry middleware.
 *
 * Retries failed tool executions based on configuration.
 *
 * Only retries errors where `result.retryable === true`. If `retryableErrors`
 * is specified, also checks that the error code matches.
 */
export function createRetryMiddleware(
  config: RetryMiddlewareConfig,
  deps: MiddlewareFactoryDeps,
): ToolExecutionMiddleware {
  return (next) => async (tool, toolCall, execCtx) => {
    let attempt = 0;
    let lastResult: AgentToolResult;

    while (true) {
      attempt++;
      lastResult = await next(tool, toolCall, execCtx);

      // Check if we should retry
      if (
        lastResult.type === 'error' &&
        shouldRetry(lastResult, config, attempt)
      ) {
        deps.logger.debug('Retrying tool execution', {
          toolName: toolCall.toolName,
          attempt,
          maxRetries: config.maxRetries,
          errorCode: lastResult.code,
          error: lastResult.error,
        });
        continue;
      }

      // Success, non-retryable error, or max retries reached
      if (lastResult.type === 'error' && attempt > 1) {
        deps.logger.debug('Tool execution failed after retries', {
          toolName: toolCall.toolName,
          attempts: attempt,
          errorCode: lastResult.code,
          error: lastResult.error,
        });
      }

      return lastResult;
    }
  };
}
