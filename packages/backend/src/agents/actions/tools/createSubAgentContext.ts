import type { AgentContext } from '@autoflow/core';
import {
  type Context,
  createContext,
} from '@backend/infrastructure/context/Context';

/**
 * Creates a sub-agent context with independent timeout.
 * If timeout is specified, creates a new AbortController that will abort after the timeout.
 * Otherwise, returns the parent context unchanged.
 */
export function createSubAgentContext(
  parentCtx: AgentContext,
  timeoutMs: number | undefined,
): Context {
  const { correlationId } = parentCtx;
  const controller = new AbortController();

  controller.signal.addEventListener(
    'abort',
    () => {
      parentCtx.signal.aborted;
    },
    { once: true },
  );

  if (!timeoutMs) {
    return createContext(correlationId, controller);
  }

  // Create a new AbortController for sub-agent timeout
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  // Link parent's abort signal to child's controller
  if (parentCtx.signal.aborted) {
    controller.abort();
  } else {
    parentCtx.signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timeoutHandle);
        controller.abort();
      },
      { once: true },
    );
  }

  // Return new context with the sub-agent's AbortSignal
  return createContext(correlationId, controller);
}
