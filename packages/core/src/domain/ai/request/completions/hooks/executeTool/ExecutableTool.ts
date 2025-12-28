import type { AgentContext } from '@core/domain/agents';
import type { Message } from '../../messages';

export interface ExecuteFunctionOptions {
  messages: Message[];
}

/**
 * Execute function for tools.
 *
 * @param ctx - Agent context with correlation ID and abort signal for cancellation
 * @param input - Tool input parsed from LLM response
 * @param options - Additional execution options including message history
 */
export type ExecuteFunction = (
  ctx: AgentContext,
  input: unknown,
  options: ExecuteFunctionOptions,
) => Promise<unknown>;
