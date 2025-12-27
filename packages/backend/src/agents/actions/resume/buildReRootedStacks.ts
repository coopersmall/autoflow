import type {
  AgentRunResult,
  SuspensionStack,
  SuspensionStackEntry,
} from '@core/domain/agents';

type SuspendedAgentRunResult = Extract<AgentRunResult, { status: 'suspended' }>;

/**
 * Builds complete suspension stacks from a re-suspended agent's result.
 *
 * Handles two cases:
 * 1. Nested sub-agent stacks: Re-roots by prepending parent path
 * 2. Direct HITL suspensions: Creates new stacks with full path to the re-suspended agent
 *
 * This ensures all suspensions have proper stacks for future resume operations.
 */
export function buildReRootedStacks(
  parentPath: SuspensionStackEntry[],
  childEntry: SuspensionStackEntry,
  suspendedResult: SuspendedAgentRunResult,
): SuspensionStack[] {
  // 1. Re-root existing child stacks (for nested sub-agent suspensions)
  const reRootedStacks = suspendedResult.suspensionStacks.map((stack) => ({
    agents: [...parentPath, ...stack.agents],
    leafSuspension: stack.leafSuspension,
  }));

  // 2. Build new stacks for direct HITL suspensions (not covered by any stack)
  //    These are suspensions in the suspensions array but not in any suspensionStack
  const stackedApprovalIds = new Set(
    suspendedResult.suspensionStacks.map((s) => s.leafSuspension.approvalId),
  );

  const directSuspensionStacks = suspendedResult.suspensions
    .filter((s) => !stackedApprovalIds.has(s.approvalId))
    .map((suspension) => ({
      agents: [
        ...parentPath,
        {
          manifestId: childEntry.manifestId,
          manifestVersion: childEntry.manifestVersion,
          stateId: suspendedResult.runId, // Use NEW state ID from result
          pendingToolCallId: undefined, // Leaf has no pending tool call
        },
      ],
      leafSuspension: suspension,
    }));

  return [...reRootedStacks, ...directSuspensionStacks];
}
