import type { AgentContext } from '@autoflow/core';
import {
  type Context,
  createContext,
} from '@backend/infrastructure/context/Context';

/**
 * Creates a sub-agent context with independent timeout.
 *
 * The sub-agent's abort signal is linked to the parent's abort signal,
 * so cancelling the parent will also cancel all sub-agents.
 *
 * If timeout is specified, the sub-agent will also abort after the timeout.
 */
export function createSubAgentContext(
  parentCtx: AgentContext,
  timeoutMs: number | undefined,
): Context {
  const { correlationId } = parentCtx;
  const controller = new AbortController();

  // Optional timeout
  const timeoutHandle = timeoutMs
    ? setTimeout(() => controller.abort(), timeoutMs)
    : undefined;

  // ALWAYS link parent's abort signal to child's controller
  // This ensures sub-agent cancellation propagates from parent
  if (parentCtx.signal.aborted) {
    controller.abort(parentCtx.signal.reason);
  } else {
    parentCtx.signal.addEventListener(
      'abort',
      () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        controller.abort(parentCtx.signal.reason);
      },
      { once: true }, // Prevents memory leak
    );
  }

  return createContext(correlationId, controller);
}
