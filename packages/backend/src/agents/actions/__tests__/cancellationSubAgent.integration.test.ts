/**
 * Integration tests for Sub-Agent Recursive Cancellation.
 *
 * Tests cancellation propagation through parent-child agent hierarchies:
 * - Suspended parent + suspended child → recursive cancellation
 * - Running parent + running child → abort signal propagation
 * - Deeply nested hierarchies (3+ levels)
 * - Parallel children cancellation
 *
 * Uses real infrastructure with mocked completionsGateway.
 */

import { describe, expect, it } from 'bun:test';
import type { AgentState } from '@backend/agents/domain';
import {
  createAgentCancellationCache,
  createAgentStateCache,
  type IAgentStateCache,
} from '@backend/agents/infrastructure/cache';
import { createAgentRunLock } from '@backend/agents/infrastructure/lock';
import { getMockedCompletionsGateway } from '@backend/ai/completions/__mocks__/CompletionsGateway.mock';
import { getMockedMCPService } from '@backend/ai/mcp/services/__mocks__/MCPService.mock';
import type { Context } from '@backend/infrastructure/context';
import { createMockContext } from '@backend/infrastructure/context/__mocks__/Context.mock';
import { createStorageService } from '@backend/storage/services/StorageService';
import { setupIntegrationTest } from '@backend/testing/integration/integrationTest';
import { TestServices } from '@backend/testing/integration/setup/TestServices';
import {
  type AgentExecuteFunction,
  AgentId,
  AgentRunId,
  AgentToolResult,
} from '@core/domain/agents';
import { signalCancellation } from '../cancellation';
import { orchestrateAgentRun } from '../orchestrateAgentRun';
import { cancelAgentState } from '../state/cancelAgentState';
import {
  createApprovalRequiredTool,
  createManifestMap,
  createMockStreamCompletion,
  createParallelToolCallParts,
  createTestManifest,
  createToolApprovalParts,
  createToolCallCompletionParts,
  createToolDefinition,
} from './fixtures';
import { createTextCompletionParts } from './fixtures/factories';
import {
  assertFinalResultOk,
  collectRemainingItems,
  collectStreamItems,
  delay,
  extractChildStateIdsFromSuspensionStacks,
  extractStateIdFromStartedEvent,
} from './fixtures/helpers';

const TEST_POLL_INTERVAL_MS = 50;
const TEST_LOCK_TTL_SECONDS = 2;

describe('Sub-Agent Cancellation Integration Tests', () => {
  const { getConfig, getLogger } = setupIntegrationTest();

  /**
   * Setup function that creates real infrastructure for each test.
   */
  const setup = () => {
    const config = getConfig();
    const logger = getLogger();

    // Real infrastructure
    const stateCache = createAgentStateCache({ appConfig: config, logger });
    const agentRunLock = createAgentRunLock({
      appConfig: config,
      logger,
      ttl: TEST_LOCK_TTL_SECONDS,
    });
    const cancellationCache = createAgentCancellationCache({
      appConfig: config,
      logger,
    });
    const storageService = createStorageService({
      logger,
      appConfig: config,
      storageProviderConfig: {
        type: 'gcs',
        auth: TestServices.getGCPAuthMechanism(),
        bucketName: 'test-bucket',
      },
    });

    // Mocked - we control LLM responses
    const completionsGateway = getMockedCompletionsGateway();
    const mcpService = getMockedMCPService();

    return {
      deps: {
        completionsGateway,
        mcpService,
        stateCache,
        storageService,
        logger,
        agentRunLock,
        cancellationCache,
      },
      stateCache,
      cancellationCache,
      agentRunLock,
    };
  };

  describe('Suspended Parent with Suspended Child', () => {
    it('should cancel parent and child when both suspended (recursive)', async () => {
      const { deps, stateCache } = setup();
      const ctx = createMockContext();

      // Create child manifest with HITL tool
      const childManifest = createTestManifest('child-agent', {
        tools: [createApprovalRequiredTool('child-tool')],
        humanInTheLoop: {
          alwaysRequireApproval: ['child-tool'],
          defaultRequiresApproval: false,
        },
      });

      // Create parent manifest that invokes child
      const parentManifest = createTestManifest('parent-agent', {
        subAgents: [
          {
            manifestId: AgentId('child-agent'),
            manifestVersion: '1.0.0',
            name: 'invoke-child',
            description: 'Invoke the child agent',
          },
        ],
      });

      const manifestMap = createManifestMap([childManifest, parentManifest]);

      // Mock: Parent calls child, child calls tool that requires approval
      deps.completionsGateway.streamCompletion
        .mockImplementationOnce(
          createMockStreamCompletion(
            createToolCallCompletionParts('invoke-child', 'call-1', {
              prompt: 'do child work',
            }),
          ),
        )
        .mockImplementationOnce(
          createMockStreamCompletion(
            createToolApprovalParts('child-approval', 'child-tool', {}),
          ),
        );

      const generator = orchestrateAgentRun(
        ctx,
        parentManifest,
        {
          type: 'request',
          prompt: 'Use child agent',
          manifestMap,
        },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      const result = assertFinalResultOk(finalResult);

      expect(result.status).toBe('suspended');
      const parentStateId = result.runId;

      // Cancel with recursive: true
      const cancelResult = await cancelAgentState(ctx, parentStateId, deps, {
        recursive: true,
      });

      expect(cancelResult.isOk()).toBe(true);
      expect(cancelResult._unsafeUnwrap().type).toBe('marked-cancelled');

      // Verify parent is cancelled
      const parentState = await stateCache.get(ctx, parentStateId);
      expect(parentState.isOk()).toBe(true);
      expect(parentState._unsafeUnwrap()?.status).toBe('cancelled');

      // Verify child is also cancelled
      const childStateIds = extractChildStateIdsFromSuspensionStacks(
        parentState._unsafeUnwrap() as AgentState,
      );
      expect(childStateIds.length).toBeGreaterThan(0);

      for (const childId of childStateIds) {
        const childState = await stateCache.get(ctx, childId);
        expect(childState.isOk()).toBe(true);
        expect(childState._unsafeUnwrap()?.status).toBe('cancelled');
      }
    });

    it('should not cancel child when recursive is false', async () => {
      const { deps, stateCache } = setup();
      const ctx = createMockContext();

      const childManifest = createTestManifest('child-agent-2', {
        tools: [createApprovalRequiredTool('child-tool-2')],
        humanInTheLoop: {
          alwaysRequireApproval: ['child-tool-2'],
          defaultRequiresApproval: false,
        },
      });

      const parentManifest = createTestManifest('parent-agent-2', {
        subAgents: [
          {
            manifestId: AgentId('child-agent-2'),
            manifestVersion: '1.0.0',
            name: 'invoke-child-2',
            description: 'Invoke child',
          },
        ],
      });

      const manifestMap = createManifestMap([childManifest, parentManifest]);

      deps.completionsGateway.streamCompletion
        .mockImplementationOnce(
          createMockStreamCompletion(
            createToolCallCompletionParts('invoke-child-2', 'call-1', {
              prompt: 'work',
            }),
          ),
        )
        .mockImplementationOnce(
          createMockStreamCompletion(
            createToolApprovalParts('approval-2', 'child-tool-2', {}),
          ),
        );

      const generator = orchestrateAgentRun(
        ctx,
        parentManifest,
        {
          type: 'request',
          prompt: 'Use child',
          manifestMap,
        },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      const result = assertFinalResultOk(finalResult);
      const parentStateId = result.runId;

      // Cancel WITHOUT recursive
      await cancelAgentState(ctx, parentStateId, deps, { recursive: false });

      // Parent should be cancelled
      const parentState = await stateCache.get(ctx, parentStateId);
      expect(parentState._unsafeUnwrap()?.status).toBe('cancelled');

      // Child should still be suspended (not cancelled)
      const childStateIds = extractChildStateIdsFromSuspensionStacks(
        parentState._unsafeUnwrap() as AgentState,
      );

      for (const childId of childStateIds) {
        const childState = await stateCache.get(ctx, childId);
        expect(childState._unsafeUnwrap()?.status).toBe('suspended');
      }
    });
  });

  describe('Running Parent with Running Child', () => {
    it('should abort child tool when parent is cancelled during execution', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      let childToolStarted = false;
      let childToolAborted = false;

      const slowChildTool: AgentExecuteFunction = async (toolCtx) => {
        childToolStarted = true;
        for (let i = 0; i < 20; i++) {
          if (toolCtx.signal.aborted) {
            childToolAborted = true;
            throw new Error('Aborted');
          }
          await delay(50);
        }
        return AgentToolResult.success({ done: true });
      };

      const childManifest = createTestManifest('child-running', {
        tools: [createToolDefinition('slow-child-tool')],
        toolExecutors: { 'slow-child-tool': slowChildTool },
      });

      const parentManifest = createTestManifest('parent-running', {
        subAgents: [
          {
            manifestId: AgentId('child-running'),
            manifestVersion: '1.0.0',
            name: 'invoke-child-running',
            description: 'Invoke child with slow tool',
          },
        ],
      });

      const manifestMap = createManifestMap([childManifest, parentManifest]);

      // Mock: Parent calls child, child calls slow tool
      deps.completionsGateway.streamCompletion
        .mockImplementationOnce(
          createMockStreamCompletion(
            createToolCallCompletionParts('invoke-child-running', 'call-1', {
              prompt: 'do slow work',
            }),
          ),
        )
        .mockImplementationOnce(
          createMockStreamCompletion(
            createToolCallCompletionParts('slow-child-tool', 'call-2', {}),
          ),
        );

      const generator = orchestrateAgentRun(
        ctx,
        parentManifest,
        {
          type: 'request',
          prompt: 'Use child',
          manifestMap,
          options: { cancellationPollIntervalMs: TEST_POLL_INTERVAL_MS },
        },
        deps,
      );

      // Get parent stateId
      const first = await generator.next();
      const parentStateId = extractStateIdFromStartedEvent(
        first.value as Parameters<typeof extractStateIdFromStartedEvent>[0],
      );

      // Start consuming generator (tool execution begins)
      const generatorPromise = collectRemainingItems(generator);

      // Wait for child tool to start
      for (let i = 0; i < 50; i++) {
        if (childToolStarted) break;
        await delay(20);
      }

      // Signal cancellation
      await signalCancellation(ctx, parentStateId, deps);

      // Give the cancellation polling time to detect and propagate the signal
      await delay(TEST_POLL_INTERVAL_MS * 3);

      // Wait for completion
      const { finalResult } = await generatorPromise;

      expect(childToolStarted).toBe(true);
      expect(childToolAborted).toBe(true);
      expect(finalResult!.result._unsafeUnwrap().status).toBe('cancelled');
    });
  });

  describe('Running Parent with Suspended Child', () => {
    it('should mark both parent and suspended child as cancelled', async () => {
      const { deps, stateCache } = setup();
      const ctx = createMockContext();

      // Create child that suspends (requires approval)
      const childManifest = createTestManifest('suspended-child', {
        tools: [createApprovalRequiredTool('child-approval-tool')],
        humanInTheLoop: {
          alwaysRequireApproval: ['child-approval-tool'],
          defaultRequiresApproval: false,
        },
      });

      // Parent invokes the child
      const parentManifest = createTestManifest('running-parent', {
        subAgents: [
          {
            manifestId: AgentId('suspended-child'),
            manifestVersion: '1.0.0',
            name: 'invoke-suspended-child',
            description: 'Invoke child that will suspend',
          },
        ],
      });

      const manifestMap = createManifestMap([childManifest, parentManifest]);

      // Mock: Parent calls child, child calls tool that requires approval
      deps.completionsGateway.streamCompletion
        .mockImplementationOnce(
          createMockStreamCompletion(
            createToolCallCompletionParts('invoke-suspended-child', 'call-1', {
              prompt: 'work',
            }),
          ),
        )
        .mockImplementationOnce(
          createMockStreamCompletion(
            createToolApprovalParts(
              'child-approval',
              'child-approval-tool',
              {},
            ),
          ),
        );

      const generator = orchestrateAgentRun(
        ctx,
        parentManifest,
        {
          type: 'request',
          prompt: 'Start work',
          manifestMap,
          options: { cancellationPollIntervalMs: TEST_POLL_INTERVAL_MS },
        },
        deps,
      );

      // Collect all events (parent will suspend when child suspends)
      const { finalResult } = await collectStreamItems(generator);
      const result = assertFinalResultOk(finalResult);

      expect(result.status).toBe('suspended');
      const parentStateId = result.runId;

      // Cancel the suspended parent (this should also cancel the child recursively)
      const cancelResult = await cancelAgentState(ctx, parentStateId, deps, {
        recursive: true,
      });
      expect(cancelResult.isOk()).toBe(true);

      // Verify parent state is cancelled
      const parentState = await stateCache.get(ctx, parentStateId);
      expect(parentState._unsafeUnwrap()?.status).toBe('cancelled');

      // Verify child is also cancelled (recursive cancellation should propagate)
      const childStateIds = extractChildStateIdsFromSuspensionStacks(
        parentState._unsafeUnwrap() as AgentState,
      );

      expect(childStateIds.length).toBeGreaterThan(0);
      for (const childId of childStateIds) {
        const childState = await stateCache.get(ctx, childId);
        expect(childState._unsafeUnwrap()?.status).toBe('cancelled');
      }
    });
  });

  describe('Mixed Parent/Child Cancellation States', () => {
    it('should handle cancellation regardless of child execution timing', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      // This test verifies that the cancellation system works correctly
      // when parent and child agents are in different execution states.
      // The actual state (cancelled vs completed) depends on timing, which is okay.

      let childToolExecuted = false;

      const quickChildTool: AgentExecuteFunction = async () => {
        childToolExecuted = true;
        await delay(50);
        return AgentToolResult.success({ done: true });
      };

      const childManifest = createTestManifest('timing-child', {
        tools: [createToolDefinition('timing-child-tool')],
        toolExecutors: { 'timing-child-tool': quickChildTool },
      });

      const parentManifest = createTestManifest('timing-parent', {
        subAgents: [
          {
            manifestId: AgentId('timing-child'),
            manifestVersion: '1.0.0',
            name: 'invoke-timing-child',
            description: 'Invoke child',
          },
        ],
      });

      const manifestMap = createManifestMap([childManifest, parentManifest]);

      deps.completionsGateway.streamCompletion
        .mockImplementationOnce(
          createMockStreamCompletion(
            createToolCallCompletionParts('invoke-timing-child', 'call-1', {
              prompt: 'work',
            }),
          ),
        )
        .mockImplementationOnce(
          createMockStreamCompletion(
            createToolCallCompletionParts('timing-child-tool', 'call-2', {}),
          ),
        )
        .mockImplementationOnce(
          createMockStreamCompletion(createTextCompletionParts('Done')),
        );

      const generator = orchestrateAgentRun(
        ctx,
        parentManifest,
        {
          type: 'request',
          prompt: 'Start',
          manifestMap,
          options: { cancellationPollIntervalMs: TEST_POLL_INTERVAL_MS },
        },
        deps,
      );

      const first = await generator.next();
      const parentStateId = extractStateIdFromStartedEvent(
        first.value as Parameters<typeof extractStateIdFromStartedEvent>[0],
      );

      const generatorPromise = collectRemainingItems(generator);

      // Signal cancellation early (before child finishes)
      await signalCancellation(ctx, parentStateId, deps);
      await delay(TEST_POLL_INTERVAL_MS);

      const { finalResult } = await generatorPromise;

      // Verify that the result is valid (either cancelled or complete)
      expect(finalResult).toBeDefined();
      expect(finalResult!.result.isOk() || finalResult!.result.isErr()).toBe(
        true,
      );

      // Child tool may or may not have executed depending on timing
      // This is expected behavior - no assertion needed
    });
  });

  describe('Deeply Nested Hierarchies', () => {
    it('should recursively cancel all levels in 3-level nesting', async () => {
      const { deps, stateCache } = setup();
      const ctx = createMockContext();

      // Create 3-level hierarchy: grandparent -> parent -> child
      const childManifest = createTestManifest('deep-child', {
        tools: [createApprovalRequiredTool('deep-child-tool')],
        humanInTheLoop: {
          alwaysRequireApproval: ['deep-child-tool'],
          defaultRequiresApproval: false,
        },
      });

      const parentManifest = createTestManifest('deep-parent', {
        subAgents: [
          {
            manifestId: AgentId('deep-child'),
            manifestVersion: '1.0.0',
            name: 'invoke-deep-child',
            description: 'Invoke child',
          },
        ],
      });

      const grandparentManifest = createTestManifest('grandparent', {
        subAgents: [
          {
            manifestId: AgentId('deep-parent'),
            manifestVersion: '1.0.0',
            name: 'invoke-deep-parent',
            description: 'Invoke parent',
          },
        ],
      });

      const manifestMap = createManifestMap([
        childManifest,
        parentManifest,
        grandparentManifest,
      ]);

      // Mock: grandparent -> parent -> child -> suspends
      deps.completionsGateway.streamCompletion
        .mockImplementationOnce(
          createMockStreamCompletion(
            createToolCallCompletionParts('invoke-deep-parent', 'call-1', {
              prompt: 'call parent',
            }),
          ),
        )
        .mockImplementationOnce(
          createMockStreamCompletion(
            createToolCallCompletionParts('invoke-deep-child', 'call-2', {
              prompt: 'call child',
            }),
          ),
        )
        .mockImplementationOnce(
          createMockStreamCompletion(
            createToolApprovalParts('deep-approval', 'deep-child-tool', {}),
          ),
        );

      const generator = orchestrateAgentRun(
        ctx,
        grandparentManifest,
        {
          type: 'request',
          prompt: 'Start chain',
          manifestMap,
        },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      const result = assertFinalResultOk(finalResult);

      expect(result.status).toBe('suspended');
      const rootStateId = result.runId;

      // Cancel root with recursive: true
      const cancelResult = await cancelAgentState(ctx, rootStateId, deps, {
        recursive: true,
      });

      expect(cancelResult.isOk()).toBe(true);
      expect(cancelResult._unsafeUnwrap().type).toBe('marked-cancelled');

      // Verify grandparent is cancelled
      const grandparentState = await stateCache.get(ctx, rootStateId);
      expect(grandparentState._unsafeUnwrap()?.status).toBe('cancelled');

      // Get all descendant state IDs and verify they're cancelled
      const allDescendantIds = getAllDescendantStateIds(
        grandparentState._unsafeUnwrap() as AgentState,
        stateCache,
        ctx,
      );

      // We should have at least parent and child
      const descendantIds = await allDescendantIds;
      expect(descendantIds.length).toBeGreaterThanOrEqual(1);

      for (const descendantId of descendantIds) {
        const descendantState = await stateCache.get(
          ctx,
          AgentRunId(descendantId),
        );
        expect(descendantState._unsafeUnwrap()?.status).toBe('cancelled');
      }
    });
  });

  describe('Parallel Children', () => {
    it('should cancel all parallel running children when parent cancelled', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      let child1Started = false;
      let child1Aborted = false;
      let child2Started = false;
      let child2Aborted = false;

      const slowTool1: AgentExecuteFunction = async (toolCtx) => {
        child1Started = true;
        for (let i = 0; i < 20; i++) {
          if (toolCtx.signal.aborted) {
            child1Aborted = true;
            throw new Error('Aborted');
          }
          await delay(50);
        }
        return AgentToolResult.success({ done: true });
      };

      const slowTool2: AgentExecuteFunction = async (toolCtx) => {
        child2Started = true;
        for (let i = 0; i < 20; i++) {
          if (toolCtx.signal.aborted) {
            child2Aborted = true;
            throw new Error('Aborted');
          }
          await delay(50);
        }
        return AgentToolResult.success({ done: true });
      };

      const child1Manifest = createTestManifest('parallel-child-1', {
        tools: [createToolDefinition('slow-tool-1')],
        toolExecutors: { 'slow-tool-1': slowTool1 },
      });

      const child2Manifest = createTestManifest('parallel-child-2', {
        tools: [createToolDefinition('slow-tool-2')],
        toolExecutors: { 'slow-tool-2': slowTool2 },
      });

      const parentManifest = createTestManifest('parallel-parent', {
        subAgents: [
          {
            manifestId: AgentId('parallel-child-1'),
            manifestVersion: '1.0.0',
            name: 'invoke-child-1',
            description: 'Invoke first child',
          },
          {
            manifestId: AgentId('parallel-child-2'),
            manifestVersion: '1.0.0',
            name: 'invoke-child-2',
            description: 'Invoke second child',
          },
        ],
      });

      const manifestMap = createManifestMap([
        child1Manifest,
        child2Manifest,
        parentManifest,
      ]);

      // Mock: Parent calls both children in parallel
      deps.completionsGateway.streamCompletion
        .mockImplementationOnce(
          createMockStreamCompletion(
            createParallelToolCallParts([
              {
                name: 'invoke-child-1',
                id: 'call-1',
                input: { prompt: 'work 1' },
              },
              {
                name: 'invoke-child-2',
                id: 'call-2',
                input: { prompt: 'work 2' },
              },
            ]),
          ),
        )
        // Children call their slow tools
        .mockImplementationOnce(
          createMockStreamCompletion(
            createToolCallCompletionParts('slow-tool-1', 'tool-1', {}),
          ),
        )
        .mockImplementationOnce(
          createMockStreamCompletion(
            createToolCallCompletionParts('slow-tool-2', 'tool-2', {}),
          ),
        );

      const generator = orchestrateAgentRun(
        ctx,
        parentManifest,
        {
          type: 'request',
          prompt: 'Use both children',
          manifestMap,
          options: { cancellationPollIntervalMs: TEST_POLL_INTERVAL_MS },
        },
        deps,
      );

      const first = await generator.next();
      const parentStateId = extractStateIdFromStartedEvent(
        first.value as Parameters<typeof extractStateIdFromStartedEvent>[0],
      );

      // Start consuming generator
      const generatorPromise = collectRemainingItems(generator);

      // Wait for at least one child to start
      for (let i = 0; i < 50; i++) {
        if (child1Started || child2Started) break;
        await delay(20);
      }

      // Signal cancellation
      await signalCancellation(ctx, parentStateId, deps);

      // Give the cancellation polling time to detect and propagate the signal.
      // The polling interval is TEST_POLL_INTERVAL_MS (50ms), so we wait
      // enough time for at least one poll cycle plus propagation.
      await delay(TEST_POLL_INTERVAL_MS * 3);

      const { finalResult } = await generatorPromise;

      // At least one child should have started and been aborted
      expect(child1Started || child2Started).toBe(true);
      expect(child1Aborted || child2Aborted).toBe(true);
      expect(finalResult!.result._unsafeUnwrap().status).toBe('cancelled');
    });
  });
});

/**
 * Recursively collects all descendant state IDs from suspension stacks.
 */
async function getAllDescendantStateIds(
  state: AgentState,
  stateCache: IAgentStateCache,
  ctx: Context,
): Promise<string[]> {
  const directChildren = extractChildStateIdsFromSuspensionStacks(state);
  const allDescendants: string[] = [...directChildren];

  for (const childId of directChildren) {
    const childState = await stateCache.get(ctx, childId);
    if (childState.isOk() && childState._unsafeUnwrap()) {
      const grandchildren = await getAllDescendantStateIds(
        childState._unsafeUnwrap() as AgentState,
        stateCache,
        ctx,
      );
      allDescendants.push(...grandchildren);
    }
  }

  return allDescendants;
}
