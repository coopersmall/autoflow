import type { Message } from '../../ai/request/completions/messages/Message';
import type { AgentContext } from '../AgentContext';
import type { AgentId } from '../AgentId';
import type { AgentRunId } from '../AgentRunId';

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
  /** Version of the agent manifest that owns this tool */
  readonly manifestVersion: string;
  /** ID of the parent agent if this is a sub-agent (for event attribution) */
  readonly parentManifestId?: AgentId;
  /** State ID of the current agent run */
  readonly stateId: AgentRunId;
}
