import type { AgentTool } from '@core/domain/agents';
import type { Message, StepResult } from '@core/domain/ai';

/**
 * Mutable runtime state object for agent execution.
 *
 * This is the in-memory state used during agent execution, distinct from
 * AgentState which is the persisted/serialized state stored in cache.
 *
 * The agent loop modifies:
 * - messages: Grows with each LLM interaction
 * - steps: Accumulates step results
 * - stepNumber: Increments with each iteration
 * - outputValidationRetries: Tracks validation retry attempts
 *
 * Immutable fields are set during initialization and don't change:
 * - startTime: When this execution started (for timeout calculation)
 * - timeoutMs: Maximum execution time allowed
 * - tools: Available tools for this agent (includes both standard and context-aware tools)
 * - toolsMap: Quick lookup map for tools
 */
export interface AgentRunState {
  readonly startTime: number;
  readonly timeoutMs: number;
  readonly tools: AgentTool[];
  readonly toolsMap: Map<string, AgentTool>;
  messages: Message[];
  steps: StepResult[];
  stepNumber: number;
  outputValidationRetries: number;
}
