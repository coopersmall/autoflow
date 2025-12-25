import type { Message } from '../../ai/request/completions/messages/Message';
import type { AgentToolResult } from './AgentToolResult';

export interface AgentExecuteContext {
  messages: Message[];
}

/**
 * Execute function for agent tools. Returns AgentToolResult instead of raw values.
 * The agent loop handles unwrapping success/error for the LLM.
 */
export type AgentExecuteFunction = (
  input: unknown,
  options: AgentExecuteContext,
) => Promise<AgentToolResult>;
