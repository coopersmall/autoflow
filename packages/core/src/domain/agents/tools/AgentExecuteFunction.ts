import type { Message } from '../../ai/request/completions/messages/Message';
import type { AgentContext } from '../AgentContext';
import type { AgentToolResult } from './AgentToolResult';

export interface AgentExecuteContext {
  messages: Message[];
}

/**
 * Execute function for agent tools. Returns AgentToolResult instead of raw values.
 * The agent loop handles unwrapping success/error for the LLM.
 *
 * @param ctx - Agent context with correlation ID and abort signal for cancellation
 * @param input - Tool input parsed from LLM response
 * @param options - Additional execution options including message history
 */
export type AgentExecuteFunction = (
  ctx: AgentContext,
  input: unknown,
  options: AgentExecuteContext,
) => Promise<AgentToolResult>;
