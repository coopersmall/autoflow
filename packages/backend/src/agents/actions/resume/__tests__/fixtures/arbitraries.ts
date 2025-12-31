import type {
  AgentId,
  AgentRunId,
  Suspension,
  SuspensionStack,
  SuspensionStackEntry,
} from '@core/domain/agents';
import * as fc from 'fast-check';

/**
 * Arbitrary for agent IDs (valid identifier strings).
 */
export const agentIdArb: fc.Arbitrary<AgentId> = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => /^[a-zA-Z][a-zA-Z0-9-_]*$/.test(s)) as fc.Arbitrary<AgentId>;

/**
 * Arbitrary for semantic versions.
 */
export const versionArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 }),
  )
  .map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

/**
 * Arbitrary for state/run IDs (UUIDs).
 */
export const stateIdArb: fc.Arbitrary<AgentRunId> =
  fc.uuid() as fc.Arbitrary<AgentRunId>;

/**
 * Arbitrary for tool call IDs (UUIDs).
 */
export const toolCallIdArb: fc.Arbitrary<string> = fc.uuid();

/**
 * Arbitrary for approval IDs (UUIDs).
 */
export const approvalIdArb: fc.Arbitrary<string> = fc.uuid();

/**
 * Arbitrary for tool names.
 */
export const toolNameArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s));

/**
 * Arbitrary for a suspension (tool approval request).
 */
export const suspensionArb: fc.Arbitrary<Suspension> = fc.record({
  type: fc.constant('tool-approval' as const),
  approvalId: approvalIdArb,
  toolName: toolNameArb,
  toolArgs: fc.dictionary(fc.string(), fc.jsonValue()),
  description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
});

/**
 * Arbitrary for a suspension stack entry (non-leaf, has pendingToolCallId).
 */
export const parentEntryArb: fc.Arbitrary<SuspensionStackEntry> = fc.record({
  manifestId: agentIdArb,
  manifestVersion: versionArb,
  stateId: stateIdArb,
  pendingToolCallId: toolCallIdArb,
});

/**
 * Arbitrary for a suspension stack entry (leaf, no pendingToolCallId).
 */
export const leafEntryArb: fc.Arbitrary<SuspensionStackEntry> = fc.record({
  manifestId: agentIdArb,
  manifestVersion: versionArb,
  stateId: stateIdArb,
  pendingToolCallId: fc.constant(undefined),
});

/**
 * Arbitrary for a valid suspension stack (2+ entries, leaf has no pendingToolCallId).
 */
export const validStackArb: fc.Arbitrary<SuspensionStack> = fc
  .integer({ min: 2, max: 5 })
  .chain((depth) =>
    fc.tuple(
      fc.array(parentEntryArb, { minLength: depth - 1, maxLength: depth - 1 }),
      leafEntryArb,
      suspensionArb,
    ),
  )
  .map(([parents, leaf, suspension]) => ({
    agents: [...parents, leaf],
    leafSuspension: suspension,
  }));

/**
 * Arbitrary for parent path (array of parent entries, 1+ elements).
 */
export const parentPathArb: fc.Arbitrary<SuspensionStackEntry[]> = fc.array(
  parentEntryArb,
  { minLength: 1, maxLength: 4 },
);

/**
 * Arbitrary for a list of unique suspensions.
 */
export const suspensionListArb: fc.Arbitrary<Suspension[]> = fc
  .array(suspensionArb, { minLength: 1, maxLength: 5 })
  .map((suspensions) => {
    // Ensure unique approvalIds
    const seen = new Set<string>();
    return suspensions.filter((s) => {
      if (seen.has(s.approvalId)) return false;
      seen.add(s.approvalId);
      return true;
    });
  });
