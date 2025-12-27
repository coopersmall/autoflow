import type {
  AgentId,
  AgentRunId,
  Suspension,
  SuspensionStack,
} from '@core/domain/agents';

/**
 * Represents a suspended branch of parallel tool execution.
 *
 * When a sub-agent suspends during parallel tool execution, we need to
 * track which tool call led to the suspension and maintain the stack trace
 * for proper resumption.
 *
 * This is used when multiple tools are called in parallel and at least one
 * invokes a sub-agent that suspends. The suspension is associated with the
 * specific tool call that triggered it.
 */
export interface SuspendedBranch {
  readonly toolCallId: string;
  readonly childStateId: AgentRunId;
  readonly childManifestId: AgentId;
  readonly childManifestVersion: string;
  readonly suspensions: Suspension[];
  readonly childStacks: SuspensionStack[];
}
