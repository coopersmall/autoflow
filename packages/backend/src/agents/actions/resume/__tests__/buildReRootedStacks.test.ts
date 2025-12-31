import { describe, expect, it } from 'bun:test';
import { AgentId, AgentRunId } from '@autoflow/core';
import * as fc from 'fast-check';
import { buildReRootedStacks } from '../buildReRootedStacks';
import {
  createSuspendedResult,
  createSuspension,
  createSuspensionStack,
  createSuspensionStackEntry,
  leafEntryArb,
  parentEntryArb,
  parentPathArb,
  suspensionArb,
} from './fixtures';

describe('buildReRootedStacks', () => {
  describe('Unit Tests', () => {
    it('should re-root single child stack by prepending parent path', () => {
      const parentPath = [
        createSuspensionStackEntry({
          manifestId: AgentId('parent'),
          stateId: AgentRunId('state-1'),
        }),
      ];
      const childEntry = createSuspensionStackEntry({
        manifestId: AgentId('child'),
        stateId: AgentRunId('state-2'),
      });

      const childStack = createSuspensionStack([
        AgentId('agent-0'),
        AgentId('agent-1'),
      ]);
      const suspendedResult = createSuspendedResult([], [childStack]);

      const result = buildReRootedStacks(
        parentPath,
        childEntry,
        suspendedResult,
      );

      expect(result.length).toBe(1);
      expect(result[0].agents.length).toBe(3); // parent + original 2
      expect(result[0].agents[0]).toBe(parentPath[0]);
    });

    it('should re-root multiple child stacks', () => {
      const parentPath = [
        createSuspensionStackEntry({
          manifestId: AgentId('parent'),
          stateId: AgentRunId('state-1'),
        }),
      ];
      const childEntry = createSuspensionStackEntry({
        manifestId: AgentId('child'),
        stateId: AgentRunId('state-2'),
      });

      const childStack1 = createSuspensionStack([
        AgentId('agent-0'),
        AgentId('agent-1'),
      ]);
      const childStack2 = createSuspensionStack([
        AgentId('agent-0'),
        AgentId('agent-1'),
        AgentId('agent-2'),
      ]);
      const suspendedResult = createSuspendedResult(
        [],
        [childStack1, childStack2],
      );

      const result = buildReRootedStacks(
        parentPath,
        childEntry,
        suspendedResult,
      );

      expect(result.length).toBe(2);
      expect(result[0].agents[0]).toBe(parentPath[0]);
      expect(result[1].agents[0]).toBe(parentPath[0]);
    });

    it('should preserve leafSuspension from child stacks', () => {
      const parentPath = [createSuspensionStackEntry()];
      const childEntry = createSuspensionStackEntry();

      const childStack = createSuspensionStack([
        AgentId('agent-0'),
        AgentId('agent-1'),
      ]);
      const originalLeafSuspension = childStack.leafSuspension;
      const suspendedResult = createSuspendedResult([], [childStack]);

      const result = buildReRootedStacks(
        parentPath,
        childEntry,
        suspendedResult,
      );

      expect(result[0].leafSuspension).toBe(originalLeafSuspension);
    });

    it('should handle empty suspensionStacks and only build from suspensions array', () => {
      const parentPath = [
        createSuspensionStackEntry({ manifestId: AgentId('parent') }),
      ];
      const childEntry = createSuspensionStackEntry({
        manifestId: AgentId('child'),
        stateId: AgentRunId('child-state'),
      });

      const suspension1 = createSuspension({ approvalId: 'approval-1' });
      const suspension2 = createSuspension({ approvalId: 'approval-2' });
      const suspendedResult = createSuspendedResult(
        [suspension1, suspension2],
        [],
        'child-state',
      );

      const result = buildReRootedStacks(
        parentPath,
        childEntry,
        suspendedResult,
      );

      expect(result.length).toBe(2);
      expect(result[0].leafSuspension).toBe(suspension1);
      expect(result[1].leafSuspension).toBe(suspension2);
    });

    it('should build stacks for direct HITL suspensions not in any stack', () => {
      const parentPath = [
        createSuspensionStackEntry({ manifestId: AgentId('parent') }),
      ];
      const childEntry = createSuspensionStackEntry({
        manifestId: AgentId('child'),
        stateId: AgentRunId('child-state'),
      });

      const stackedSuspension = createSuspension({ approvalId: 'stacked' });
      const directSuspension = createSuspension({ approvalId: 'direct' });

      const childStack = createSuspensionStack([
        AgentId('agent-0'),
        AgentId('agent-1'),
      ]);
      childStack.leafSuspension = stackedSuspension;

      const suspendedResult = createSuspendedResult(
        [stackedSuspension, directSuspension],
        [childStack],
        'child-state',
      );

      const result = buildReRootedStacks(
        parentPath,
        childEntry,
        suspendedResult,
      );

      expect(result.length).toBe(2); // 1 re-rooted + 1 direct
      const directStack = result.find(
        (s) => s.leafSuspension.approvalId === 'direct',
      );
      expect(directStack).toBeDefined();
      expect(directStack!.agents.length).toBe(2); // parent + child
    });

    it('should use result runId for new state in direct HITL stacks', () => {
      const parentPath = [createSuspensionStackEntry()];
      const childEntry = createSuspensionStackEntry({
        stateId: AgentRunId('old-state'),
      });

      const suspension = createSuspension();
      const suspendedResult = createSuspendedResult(
        [suspension],
        [],
        'new-state-id',
      );

      const result = buildReRootedStacks(
        parentPath,
        childEntry,
        suspendedResult,
      );

      expect(result[0].agents[1].stateId).toBe(AgentRunId('new-state-id'));
    });

    it('should exclude already-stacked suspensions from direct stacks', () => {
      const parentPath = [createSuspensionStackEntry()];
      const childEntry = createSuspensionStackEntry({
        stateId: AgentRunId('state'),
      });

      const suspension = createSuspension({ approvalId: 'same-id' });
      const childStack = createSuspensionStack([
        AgentId('agent-0'),
        AgentId('agent-1'),
      ]);
      childStack.leafSuspension = suspension;

      const suspendedResult = createSuspendedResult(
        [suspension],
        [childStack],
        'state',
      );

      const result = buildReRootedStacks(
        parentPath,
        childEntry,
        suspendedResult,
      );

      // Should only have 1 stack (re-rooted), not 2 (re-rooted + direct duplicate)
      expect(result.length).toBe(1);
    });

    it('should handle empty suspensions array gracefully', () => {
      const parentPath = [createSuspensionStackEntry()];
      const childEntry = createSuspensionStackEntry();

      const childStack = createSuspensionStack([
        AgentId('agent-0'),
        AgentId('agent-1'),
      ]);
      const suspendedResult = createSuspendedResult([], [childStack]);

      const result = buildReRootedStacks(
        parentPath,
        childEntry,
        suspendedResult,
      );

      expect(result.length).toBe(1); // Only re-rooted stack, no direct stacks
    });
  });

  describe('Property Tests', () => {
    it('should ensure output count equals input stacks plus unstacked suspensions', async () => {
      await fc.assert(
        fc.asyncProperty(
          parentPathArb,
          parentEntryArb,
          fc.array(suspensionArb, { minLength: 1, maxLength: 5 }),
          fc.array(
            fc.tuple(
              fc.array(parentEntryArb, { minLength: 1 }),
              leafEntryArb,
              suspensionArb,
            ),
            { maxLength: 3 },
          ),
          async (parentPath, childEntry, suspensions, stackData) => {
            // Build child stacks
            const childStacks = stackData.map(([agents, leaf, suspension]) => ({
              agents: [...agents, leaf],
              leafSuspension: suspension,
            }));

            // Mark some suspensions as stacked
            const stackedApprovalIds = new Set(
              childStacks.map((s) => s.leafSuspension.approvalId),
            );
            const unstackedCount = suspensions.filter(
              (s) => !stackedApprovalIds.has(s.approvalId),
            ).length;

            const suspendedResult = createSuspendedResult(
              suspensions,
              childStacks,
            );

            const result = buildReRootedStacks(
              parentPath,
              childEntry,
              suspendedResult,
            );

            expect(result.length).toBe(childStacks.length + unstackedCount);
          },
        ),
        { numRuns: 30 },
      );
    });

    it('should ensure all outputs have parentPath as prefix', async () => {
      await fc.assert(
        fc.asyncProperty(
          parentPathArb,
          parentEntryArb,
          fc.array(suspensionArb, { minLength: 1, maxLength: 3 }),
          async (parentPath, childEntry, suspensions) => {
            const suspendedResult = createSuspendedResult(suspensions, []);

            const result = buildReRootedStacks(
              parentPath,
              childEntry,
              suspendedResult,
            );

            for (const stack of result) {
              // First N entries should match parentPath
              for (let i = 0; i < parentPath.length; i++) {
                expect(stack.agents[i]).toBe(parentPath[i]);
              }
            }
          },
        ),
        { numRuns: 30 },
      );
    });

    it('should ensure no duplicate approvalIds in output', async () => {
      await fc.assert(
        fc.asyncProperty(
          parentPathArb,
          parentEntryArb,
          fc.array(suspensionArb, { minLength: 1, maxLength: 5 }),
          async (parentPath, childEntry, suspensions) => {
            // Ensure unique approval IDs in input
            const uniqueSuspensions = Array.from(
              new Map(suspensions.map((s) => [s.approvalId, s])).values(),
            );

            const suspendedResult = createSuspendedResult(
              uniqueSuspensions,
              [],
            );

            const result = buildReRootedStacks(
              parentPath,
              childEntry,
              suspendedResult,
            );

            const approvalIds = result.map((s) => s.leafSuspension.approvalId);
            const uniqueIds = new Set(approvalIds);

            expect(approvalIds.length).toBe(uniqueIds.size);
          },
        ),
        { numRuns: 20 },
      );
    });
  });
});
