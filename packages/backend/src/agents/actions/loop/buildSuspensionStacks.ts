import type { AgentManifest } from '@backend/agents/domain';
import type { SuspendedBranch } from '@backend/agents/domain/execution';
import type {
  AgentRunId,
  SuspensionStack,
  SuspensionStackEntry,
} from '@core/domain/agents';

export interface BuildSuspensionStacksParams {
  readonly manifest: AgentManifest;
  readonly stateId: AgentRunId;
  readonly branches: SuspendedBranch[];
}

/**
 * Builds suspension stacks from suspended branches.
 *
 * For each branch:
 * - If branch has childStacks (nested sub-agent), prepend current agent's entry to each
 * - If branch has no childStacks (direct sub-agent), create new stack with current agent + leaf
 *
 * @returns Array of SuspensionStack, one per suspension path
 */
export function buildSuspensionStacks(
  params: BuildSuspensionStacksParams,
): SuspensionStack[] {
  const { manifest, stateId, branches } = params;

  const stacks: SuspensionStack[] = [];

  for (const branch of branches) {
    const currentEntry: SuspensionStackEntry = {
      manifestId: manifest.config.id,
      manifestVersion: manifest.config.version,
      stateId,
      pendingToolCallId: branch.toolCallId,
    };

    if (branch.childStacks.length > 0) {
      // Nested sub-agent: prepend our entry to each child stack
      for (const childStack of branch.childStacks) {
        stacks.push({
          agents: [currentEntry, ...childStack.agents],
          leafSuspension: childStack.leafSuspension,
        });
      }
    } else {
      // Direct sub-agent: create stack with parent + child entries
      const childEntry: SuspensionStackEntry = {
        manifestId: branch.childManifestId,
        manifestVersion: branch.childManifestVersion,
        stateId: branch.childStateId,
        pendingToolCallId: undefined, // Leaf has no pending tool call
      };

      for (const suspension of branch.suspensions) {
        stacks.push({
          agents: [currentEntry, childEntry], // Both parent AND child
          leafSuspension: suspension,
        });
      }
    }
  }

  return stacks;
}
