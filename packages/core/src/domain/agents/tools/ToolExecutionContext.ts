import type { Message } from '../../ai/request/completions/messages/Message';
import type { AgentContext } from '../AgentContext';
import type { AgentId } from '../AgentId';

/**
 * Context passed to tool executors.
 * Includes the request context for cancellation and the current conversation state.
 */
export interface ToolExecutionContext {
  /** Request context (satisfies AgentContext interface) */
  readonly ctx: AgentContext;
  /** Current conversation messages */
  readonly messages: Message[];
  /** Current step number in the agent loop */
  readonly stepNumber: number;
  /** ID of the agent that owns this tool (source of events) */
  readonly manifestId: AgentId;
  /** ID of the parent agent if this is a sub-agent (for event attribution) */
  readonly parentManifestId?: AgentId;
}
