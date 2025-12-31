import type {
  AgentExecutionDeps,
  AgentInput,
  AgentManifest,
} from '@backend/agents/domain';
import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentRunResult } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';
import { orchestrateAgentRun } from './orchestrateAgentRun';

/**
 * Dependencies required for running an agent.
 * Equivalent to AgentExecutionDeps which includes all core agent infrastructure.
 */
export type RunAgentDeps = AgentExecutionDeps;

/**
 * Non-streaming agent execution entry point.
 *
 * Thin wrapper around orchestrateAgentRun that consumes the generator
 * and returns only the final result.
 *
 * Handles three types of execution:
 * 1. Fresh start from AgentRequest
 * 2. Reply to a completed agent with additional user message
 * 3. Resume suspended agent after tool approval
 *
 * NOTE: Callers should validate the agent configuration before calling this function
 * using `validateAgentRunConfig(config)` to ensure sub-agent references
 * and other config validations pass. This validation is automatic when using
 * AgentService, but direct callers should validate manually.
 *
 * @param ctx - The request context with correlationId and abort signal
 * @param manifest - The root agent manifest configuration
 * @param input - The agent input including prompt, manifestMap, and options
 * @param deps - Dependencies required for execution (completions, state, etc.)
 * @returns A Result containing the agent run result or an error
 */
export async function runAgent(
  ctx: Context,
  manifest: AgentManifest,
  input: AgentInput,
  deps: RunAgentDeps,
): Promise<Result<AgentRunResult, AppError>> {
  const generator = orchestrateAgentRun(ctx, manifest, input, deps);

  // Consume generator, discard events, return final result
  while (true) {
    const next = await generator.next();
    if (next.done) {
      return next.value;
    }
    // Discard events (non-streaming mode)
  }
}
