import type { Message } from '../../ai/request/completions/messages/Message';
import type { AgentContext } from '../AgentContext';

/**
 * Context passed to tool executors.
 * Includes the request context for cancellation and the current conversation state.
 */
export interface ToolExecutionContext {
  /** Request context (satisfies AgentContext interface) */
  readonly ctx: AgentContext;
  /** Current conversation messages */
  readonly messages: readonly Message[];
  /** Current step number in the agent loop */
  readonly stepNumber: number;
}
