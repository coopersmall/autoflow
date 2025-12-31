import type { AgentState } from '@backend/agents/domain';
import type { AgentRunId } from '@core/domain/agents';

/**
 * Extracts child state IDs from a suspended agent's suspension stacks.
 *
 * Each suspension stack contains entries for the parent and all nested children.
 * This function extracts all state IDs that are NOT the current agent's state ID,
 * which represents the child (and grandchild, etc.) states.
 *
 * Used for recursive cancellation and cleanup of suspended agent hierarchies.
 *
 * @param state - The agent state to extract child IDs from
 * @returns Array of unique child state IDs
 */
export function extractChildStateIdsFromStacks(
  state: AgentState,
): AgentRunId[] {
  const childIds = new Set<AgentRunId>();

  for (const stack of state.suspensionStacks) {
    // Each stack has agents: [parent, child, grandchild, ...]
    // We want all entries except our own state
    for (const entry of stack.agents) {
      if (entry.stateId !== state.id) {
        childIds.add(entry.stateId);
      }
    }
  }

  return [...childIds];
}
