import {
  AgentToolResult,
  type TimeoutMiddlewareConfig,
} from '@core/domain/agents';
import type {
  StreamingToolExecutionMiddleware,
  ToolExecutionMiddleware,
} from '@core/domain/agents/tools';
import type { MiddlewareFactoryDeps } from './types';

/**
 * Sentinel symbol to identify timeout - cannot be confused with real results.
 */
const TIMEOUT_SENTINEL = Symbol('timeout');

/**
 * Creates a timeout error result with consistent messaging.
 */
function createTimeoutError(ms: number) {
  return AgentToolResult.error(
    `Tool execution timed out after ${ms}ms`,
    'Timeout',
    false,
  );
}

/**
 * Creates a timeout promise that resolves with a sentinel value.
 * Uses resolve instead of reject to avoid throwing.
 */
function createTimeoutPromise<T>(
  ms: number,
  sentinel: T,
): { promise: Promise<T>; cleanup: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const promise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(sentinel), ms);
  });

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };

  return { promise, cleanup };
}

/**
 * Creates streaming timeout middleware.
 *
 * Wraps tool execution with an absolute timeout. If the tool (including all
 * yielded events) takes longer than the configured duration, returns a timeout error.
 *
 * For streaming tools, the timeout covers the entire generator lifecycle -
 * from first call to final return value.
 */
export function createStreamingTimeoutMiddleware(
  config: TimeoutMiddlewareConfig,
  deps: MiddlewareFactoryDeps,
): StreamingToolExecutionMiddleware {
  const { ms } = config;

  return (next) =>
    async function* (tool, toolCall, execCtx) {
      const { promise: timeoutPromise, cleanup } = createTimeoutPromise(
        ms,
        TIMEOUT_SENTINEL,
      );

      try {
        const generator = next(tool, toolCall, execCtx);

        while (true) {
          // Race between next value and timeout
          const result = await Promise.race([generator.next(), timeoutPromise]);

          // Check for timeout sentinel
          if (result === TIMEOUT_SENTINEL) {
            deps.logger.debug('Tool execution timed out', {
              toolName: toolCall.toolName,
              timeoutMs: ms,
            });
            return createTimeoutError(ms);
          }

          // TypeScript narrowing: result is IteratorResult
          if (result.done) {
            return result.value;
          }

          yield result.value;
        }
      } finally {
        cleanup();
      }
    };
}

/**
 * Creates non-streaming timeout middleware.
 *
 * Wraps tool execution with an absolute timeout. If the tool takes longer
 * than the configured duration, returns a timeout error.
 */
export function createTimeoutMiddleware(
  config: TimeoutMiddlewareConfig,
  deps: MiddlewareFactoryDeps,
): ToolExecutionMiddleware {
  const { ms } = config;

  return (next) => async (tool, toolCall, execCtx) => {
    const { promise: timeoutPromise, cleanup } = createTimeoutPromise(
      ms,
      TIMEOUT_SENTINEL,
    );

    try {
      const result = await Promise.race([
        next(tool, toolCall, execCtx),
        timeoutPromise,
      ]);

      // Check for timeout sentinel
      if (result === TIMEOUT_SENTINEL) {
        deps.logger.debug('Tool execution timed out', {
          toolName: toolCall.toolName,
          timeoutMs: ms,
        });
        return createTimeoutError(ms);
      }

      return result;
    } finally {
      cleanup();
    }
  };
}
