import type { Tool } from '../../ai/request/completions/tools/Tool';
import type { ToolExecutor } from './ToolExecutor';

/**
 * A tool that requires full execution context (e.g., sub-agent tools).
 *
 * Unlike regular tools which only receive (input, { messages }),
 * context-aware tools receive the full ToolExecutionContext including:
 * - ctx: AgentContext (with correlationId and AbortSignal)
 * - messages: Current conversation state
 * - stepNumber: Current step in the agent loop
 *
 * The harness will call executeWithContext instead of execute for these tools.
 *
 * Used primarily for:
 * - Sub-agent tools (need parent context for timeout management)
 * - Future: Tools that need cancellation support
 * - Future: Tools that need correlation tracking
 */
export type AgentToolWithContext = Tool & {
  executeWithContext: ToolExecutor;
};
