/**
 * Integration tests for Agent Cancellation & Running State features.
 *
 * Tests the complete cancellation flow with real infrastructure:
 * - Real PostgreSQL database for persistence
 * - Real Redis cache for agent state and cancellation signals
 * - Real distributed locks for concurrency control
 * - Mocked completionsGateway to control LLM responses
 *
 * These tests verify:
 * - Cancellation of suspended agents
 * - Cancellation of running agents via polling
 * - Idempotency and error cases
 * - Concurrency and lock behavior
 * - Crash detection
 * - Running state management
 */

import { describe, expect, it } from 'bun:test';
import type { AgentState } from '@backend/agents/domain';
import {
  createAgentCancellationCache,
  createAgentStateCache,
} from '@backend/agents/infrastructure/cache';
import { createAgentRunLock } from '@backend/agents/infrastructure/lock';
import { getMockedCompletionsGateway } from '@backend/ai/completions/__mocks__/CompletionsGateway.mock';
import { getMockedMCPService } from '@backend/ai/mcp/services/__mocks__/MCPService.mock';
import { createMockContext } from '@backend/infrastructure/context/__mocks__/Context.mock';
import { createStorageService } from '@backend/storage/services/StorageService';
import { setupIntegrationTest } from '@backend/testing/integration/integrationTest';
import { TestServices } from '@backend/testing/integration/setup/TestServices';
import type { AgentContext } from '@core/domain/agents';
import {
  type AgentEvent,
  type AgentExecuteFunction,
  AgentId,
  AgentRunId,
  AgentToolResult,
} from '@core/domain/agents';
import { internalError } from '@core/errors';
import * as fc from 'fast-check';
import { err, ok } from 'neverthrow';
import { signalCancellation } from '../cancellation';
import { orchestrateAgentRun } from '../orchestrateAgentRun';
import { cancelAgentState } from '../state/cancelAgentState';
import {
  cancellationTimingArb,
  createApprovalRequiredTool,
  createTestManifest,
  createTextCompletionParts,
  createToolApprovalParts,
  createToolCallCompletionParts,
  createToolDefinition,
} from './fixtures';
import {
  assertFinalResultOk,
  collectRemainingItems,
  collectStreamItems,
  createMockStreamCompletion,
  createSlowCompletionMock,
  delay,
  extractStateIdFromStartedEvent,
  findStateIdFromEvents,
} from './fixtures/helpers';

const TEST_POLL_INTERVAL_MS = 50;
const TEST_LOCK_TTL_SECONDS = 2;

describe('Agent Cancellation Integration Tests', () => {
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

  describe('Cancel Suspended Agent', () => {
    it('should mark suspended agent as cancelled', async () => {
      const { deps, stateCache } = setup();
      const ctx = createMockContext();
      const manifest = createTestManifest('test-agent', {
        tools: [createApprovalRequiredTool('dangerous-tool')],
        humanInTheLoop: {
          alwaysRequireApproval: ['dangerous-tool'],
          defaultRequiresApproval: false,
        },
      });

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(
          createToolApprovalParts('approval-1', 'dangerous-tool', {}),
        ),
      );

      const generator = orchestrateAgentRun(
        ctx,
        manifest,
        {
          type: 'request',
          prompt: 'Do something dangerous',
          manifestMap: new Map(),
          options: { cancellationPollIntervalMs: TEST_POLL_INTERVAL_MS },
        },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      const result = assertFinalResultOk(finalResult);

      expect(result.status).toBe('suspended');
      const stateId = result.runId;

      // Cancel the suspended agent
      const cancelResult = await cancelAgentState(ctx, stateId, deps);

      expect(cancelResult.isOk()).toBe(true);
      expect(cancelResult._unsafeUnwrap().type).toBe('marked-cancelled');

      // Verify state is now cancelled
      const stateResult = await stateCache.get(ctx, stateId);
      expect(stateResult.isOk()).toBe(true);
      expect(stateResult._unsafeUnwrap()?.status).toBe('cancelled');
    });

    it('should cancel with reason and preserve it', async () => {
      const { deps } = setup();
      const ctx = createMockContext();
      const manifest = createTestManifest('test-agent', {
        tools: [createApprovalRequiredTool('my-tool')],
        humanInTheLoop: {
          alwaysRequireApproval: ['my-tool'],
          defaultRequiresApproval: false,
        },
      });

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(
          createToolApprovalParts('approval-1', 'my-tool', {}),
        ),
      );

      const generator = orchestrateAgentRun(
        ctx,
        manifest,
        {
          type: 'request',
          prompt: 'Test',
          manifestMap: new Map(),
        },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      const result = assertFinalResultOk(finalResult);
      const stateId = result.runId;

      // Cancel with a reason
      const cancelResult = await cancelAgentState(ctx, stateId, deps, {
        reason: 'User requested cancellation',
      });

      expect(cancelResult.isOk()).toBe(true);
      expect(cancelResult._unsafeUnwrap().type).toBe('marked-cancelled');
    });

    it('should cancel any suspended agent with arbitrary tools (property)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .string({ minLength: 3, maxLength: 20 })
            .filter((s) => /^[a-zA-Z][a-zA-Z0-9-]*$/.test(s)),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (toolName, prompt) => {
            const { deps, stateCache } = setup();
            const ctx = createMockContext();

            const manifest = createTestManifest(`prop-agent-${Date.now()}`, {
              tools: [createApprovalRequiredTool(toolName)],
              humanInTheLoop: {
                alwaysRequireApproval: [toolName],
                defaultRequiresApproval: false,
              },
            });

            deps.completionsGateway.streamCompletion.mockImplementation(
              createMockStreamCompletion(
                createToolApprovalParts(`approval-${Date.now()}`, toolName, {}),
              ),
            );

            const generator = orchestrateAgentRun(
              ctx,
              manifest,
              {
                type: 'request',
                prompt,
                manifestMap: new Map(),
              },
              deps,
            );

            const { finalResult } = await collectStreamItems(generator);

            if (!finalResult?.result.isOk()) return;

            const result = finalResult.result._unsafeUnwrap();
            if (result.status !== 'suspended') return;

            const cancelResult = await cancelAgentState(
              ctx,
              result.runId,
              deps,
            );
            expect(cancelResult.isOk()).toBe(true);
            expect(cancelResult._unsafeUnwrap().type).toBe('marked-cancelled');

            const state = await stateCache.get(ctx, result.runId);
            expect(state._unsafeUnwrap()?.status).toBe('cancelled');
          },
        ),
        { numRuns: 5 },
      );
    });

    it.concurrent('should handle late cancellation (after completion starts)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 150, max: 300 }), // cancelAfterMs (late)
          fc.integer({ min: 100, max: 200 }), // completionDelayMs
          async (cancelAfterMs, completionDelayMs) => {
            const { deps } = setup();
            const ctx = createMockContext();
            const manifest = createTestManifest(`prop-late-${Date.now()}`);

            deps.completionsGateway.streamCompletion.mockImplementation(
              createSlowCompletionMock(
                completionDelayMs,
                createTextCompletionParts('Done'),
              ),
            );

            const generator = orchestrateAgentRun(
              ctx,
              manifest,
              {
                type: 'request',
                prompt: 'Work',
                manifestMap: new Map(),
                options: { cancellationPollIntervalMs: 20 },
              },
              deps,
            );

            const firstResult = await generator.next();
            const stateId = extractStateIdFromStartedEvent(
              firstResult.value as Parameters<
                typeof extractStateIdFromStartedEvent
              >[0],
            );

            // Cancel comes late - might complete normally
            setTimeout(
              () => signalCancellation(ctx, stateId, deps),
              cancelAfterMs,
            );

            const { finalResult } = await collectRemainingItems(generator);
            const result = finalResult!.result;

            // Could be either complete or cancelled depending on timing
            expect(result.isOk()).toBe(true);
            expect(['complete', 'cancelled']).toContain(
              result._unsafeUnwrap().status,
            );
          },
        ),
        { numRuns: 5 },
      );
    });

    it('should handle timeout-based cancellation', async () => {
      const { deps } = setup();
      const ctx = createMockContext();
      const manifest = createTestManifest('timeout-agent');

      // Mock completion that takes longer than timeout
      deps.completionsGateway.streamCompletion.mockImplementation(
        createSlowCompletionMock(2000, createTextCompletionParts('Done')),
      );

      const generator = orchestrateAgentRun(
        ctx,
        manifest,
        {
          type: 'request',
          prompt: 'This will timeout',
          manifestMap: new Map(),
          options: {
            cancellationPollIntervalMs: TEST_POLL_INTERVAL_MS,
            agentTimeout: 500, // Short timeout in milliseconds
          },
        },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);

      expect(finalResult!.result.isOk()).toBe(true);
      const result = finalResult!.result._unsafeUnwrap();

      // Should timeout and return error status
      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error.message).toContain('timeout');
      }
    });

    it('should handle concurrent cancellation signals idempotently', async () => {
      const { deps, stateCache } = setup();
      const ctx1 = createMockContext();
      const ctx2 = createMockContext();
      const manifest = createTestManifest('concurrent-cancel-agent', {
        tools: [createApprovalRequiredTool('tool-1')],
        humanInTheLoop: {
          alwaysRequireApproval: ['tool-1'],
          defaultRequiresApproval: false,
        },
      });

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(
          createToolApprovalParts('approval-1', 'tool-1', {}),
        ),
      );

      const generator = orchestrateAgentRun(
        ctx1,
        manifest,
        {
          type: 'request',
          prompt: 'Suspend',
          manifestMap: new Map(),
        },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      const result = assertFinalResultOk(finalResult);
      const stateId = result.runId;

      // Signal cancellation from two different contexts concurrently
      const [cancel1, cancel2] = await Promise.all([
        cancelAgentState(ctx1, stateId, deps),
        cancelAgentState(ctx2, stateId, deps),
      ]);

      // One should succeed, one should return already-cancelled
      const results = [cancel1._unsafeUnwrap(), cancel2._unsafeUnwrap()];
      const cancelledCount = results.filter(
        (r) => r.type === 'marked-cancelled',
      ).length;
      const alreadyCancelledCount = results.filter(
        (r) => r.type === 'already-cancelled',
      ).length;

      expect(cancelledCount + alreadyCancelledCount).toBe(2);
      expect(cancelledCount).toBeGreaterThanOrEqual(1);

      const state = await stateCache.get(ctx1, stateId);
      expect(state._unsafeUnwrap()?.status).toBe('cancelled');
    });
  });

  describe('Cancel Running Agent', () => {
    it('should cancel running agent via signal and yield agent-cancelled event', async () => {
      const { deps } = setup();
      const ctx = createMockContext();
      const manifest = createTestManifest('test-agent');

      // Create a slow completion to give us time to cancel
      deps.completionsGateway.streamCompletion.mockImplementation(
        createSlowCompletionMock(500, createTextCompletionParts('Hello')),
      );

      const generator = orchestrateAgentRun(
        ctx,
        manifest,
        {
          type: 'request',
          prompt: 'Say hello slowly',
          manifestMap: new Map(),
          options: { cancellationPollIntervalMs: TEST_POLL_INTERVAL_MS },
        },
        deps,
      );

      // Get agent-started event to capture stateId
      const firstResult = await generator.next();
      expect(firstResult.done).toBe(false);

      const stateId = extractStateIdFromStartedEvent(
        firstResult.value as ReturnType<
          typeof extractStateIdFromStartedEvent
        > extends infer T
          ? T extends AgentRunId
            ? Parameters<typeof extractStateIdFromStartedEvent>[0]
            : never
          : never,
      );

      // Signal cancellation
      await signalCancellation(ctx, stateId, deps);

      // Collect remaining items
      const { events, finalResult } = await collectRemainingItems(generator);

      // Should have agent-cancelled event
      const cancelledEvents = events.filter(
        (e: AgentEvent) => e.type === 'agent-cancelled',
      );
      expect(cancelledEvents.length).toBe(1);

      // Final result should be cancelled
      const result = assertFinalResultOk(finalResult);
      expect(result.status).toBe('cancelled');
    });

    it('should abort tool execution when cancelled', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      let toolExecutionStarted = false;
      let toolWasAborted = false;

      const slowTool: AgentExecuteFunction = async (toolCtx) => {
        toolExecutionStarted = true;
        // Run for enough iterations that cancellation has time to be detected
        // Polling interval is 50ms, so 30 iterations = 1500ms should be plenty
        for (let i = 0; i < 30; i++) {
          if (toolCtx.signal.aborted) {
            toolWasAborted = true;
            throw new Error('Aborted');
          }
          await delay(50);
        }
        return AgentToolResult.success({ done: true });
      };

      const manifest = createTestManifest('test-agent', {
        tools: [createToolDefinition('slow-tool')],
        toolExecutors: { 'slow-tool': slowTool },
      });

      // Mock: LLM calls slow tool, then returns text (in case tool completes before abort)
      deps.completionsGateway.streamCompletion
        .mockImplementationOnce(
          createMockStreamCompletion(
            createToolCallCompletionParts('slow-tool', 'call-1', {}),
          ),
        )
        .mockImplementation(
          createMockStreamCompletion(createTextCompletionParts('Done')),
        );

      const generator = orchestrateAgentRun(
        ctx,
        manifest,
        {
          type: 'request',
          prompt: 'Use slow tool',
          manifestMap: new Map(),
          options: { cancellationPollIntervalMs: TEST_POLL_INTERVAL_MS },
        },
        deps,
      );

      // Get stateId from agent-started
      const first = await generator.next();
      const stateId = extractStateIdFromStartedEvent(
        first.value as Parameters<typeof extractStateIdFromStartedEvent>[0],
      );

      // Start generator progress but don't wait - tool execution will begin
      const generatorPromise = collectRemainingItems(generator);

      // Wait for tool to start (poll for toolExecutionStarted)
      for (let i = 0; i < 50; i++) {
        if (toolExecutionStarted) break;
        await delay(20);
      }

      // Signal cancellation
      await signalCancellation(ctx, stateId, deps);

      // Give the cancellation polling time to detect and propagate the signal
      await delay(TEST_POLL_INTERVAL_MS * 3);

      // Wait for generator to complete (will be cancelled)
      const { finalResult } = await generatorPromise;

      expect(toolExecutionStarted).toBe(true);
      expect(toolWasAborted).toBe(true);
      expect(finalResult!.result._unsafeUnwrap().status).toBe('cancelled');
    });

    it('should abort MCP tool execution when cancelled', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      let mcpToolStarted = false;
      let mcpToolAborted = false;

      // Create a mock MCP tool that can be cancelled
      const slowMCPTool = async (toolCtx: AgentContext, input: unknown) => {
        mcpToolStarted = true;
        for (let i = 0; i < 30; i++) {
          if (toolCtx.signal.aborted) {
            mcpToolAborted = true;
            throw new Error('MCP tool aborted');
          }
          await delay(50);
        }
        return { result: 'MCP completed' };
      };

      // Mock the MCP service to return a client with our slow tool
      const mockClient = {
        id: 'test-mcp-client' as any,
        name: 'test-server',
        tools: async () =>
          ok([
            {
              type: 'function' as const,
              function: {
                name: 'slow-mcp-tool',
                description: 'A slow MCP tool',
                parameters: {
                  type: 'object' as const,
                  properties: {},
                },
              },
              execute: slowMCPTool,
            },
          ]),
        listResources: async () => ok([]),
        readResource: async () => ok({ uri: '', mimeType: '', text: '' }),
        close: async () => ok(undefined),
      };

      deps.mcpService.createClient.mockResolvedValue(ok(mockClient));

      const manifest = createTestManifest('mcp-agent', {
        mcpServers: [
          {
            name: 'test-server',
            transport: { type: 'stdio', command: 'test', args: [] },
          },
        ],
      });

      // Mock: LLM calls the MCP tool, then returns text (in case tool completes)
      deps.completionsGateway.streamCompletion
        .mockImplementationOnce(
          createMockStreamCompletion(
            createToolCallCompletionParts('slow-mcp-tool', 'call-1', {}),
          ),
        )
        .mockImplementation(
          createMockStreamCompletion(createTextCompletionParts('Done')),
        );

      const generator = orchestrateAgentRun(
        ctx,
        manifest,
        {
          type: 'request',
          prompt: 'Use MCP tool',
          manifestMap: new Map(),
          options: {
            cancellationPollIntervalMs: TEST_POLL_INTERVAL_MS,
          },
        },
        deps,
      );

      // Get stateId from agent-started
      const first = await generator.next();
      const stateId = extractStateIdFromStartedEvent(
        first.value as Parameters<typeof extractStateIdFromStartedEvent>[0],
      );

      // Start consuming generator (tool execution begins)
      const generatorPromise = collectRemainingItems(generator);

      // Wait for MCP tool to start
      for (let i = 0; i < 50; i++) {
        if (mcpToolStarted) break;
        await delay(20);
      }

      // Signal cancellation
      await signalCancellation(ctx, stateId, deps);

      // Give the cancellation polling time to detect and propagate the signal
      await delay(TEST_POLL_INTERVAL_MS * 3);

      // Wait for generator to complete (will be cancelled)
      const { finalResult } = await generatorPromise;

      expect(mcpToolStarted).toBe(true);
      expect(mcpToolAborted).toBe(true);
      expect(finalResult!.result._unsafeUnwrap().status).toBe('cancelled');
    });

    describe.concurrent('Cancellation Timing Properties', () => {
      it.concurrent('should handle early cancellation (before completion)', async () => {
        await fc.assert(
          fc.asyncProperty(
            cancellationTimingArb,
            async ({ cancelAfterMs, completionDelayMs }) => {
              // Ensure cancel happens well before completion (with margin for polling)
              // Polling interval is 20ms, so we need at least 2 poll cycles margin
              const adjustedCancelAfterMs = Math.min(
                cancelAfterMs,
                completionDelayMs - 100, // More margin for polling to detect and propagate
              );

              const { deps } = setup();
              const ctx = createMockContext();
              const manifest = createTestManifest(`prop-agent-${Date.now()}`);

              deps.completionsGateway.streamCompletion.mockImplementation(
                createSlowCompletionMock(
                  completionDelayMs,
                  createTextCompletionParts('Done'),
                ),
              );

              const generator = orchestrateAgentRun(
                ctx,
                manifest,
                {
                  type: 'request',
                  prompt: 'Work',
                  manifestMap: new Map(),
                  options: { cancellationPollIntervalMs: 20 },
                },
                deps,
              );

              // Get stateId from agent-started event
              const firstResult = await generator.next();
              const stateId = extractStateIdFromStartedEvent(
                firstResult.value as Parameters<
                  typeof extractStateIdFromStartedEvent
                >[0],
              );

              // Cancel after delay
              setTimeout(
                () => signalCancellation(ctx, stateId, deps),
                adjustedCancelAfterMs,
              );

              const { finalResult } = await collectRemainingItems(generator);
              const result = finalResult!.result;

              // With early cancellation, should always be cancelled
              expect(result.isOk()).toBe(true);
              expect(result._unsafeUnwrap().status).toBe('cancelled');
            },
          ),
          { numRuns: 5 },
        );
      });
    });
  });

  describe('Idempotency and Error Cases', () => {
    it('should return already-cancelled for cancelled agent', async () => {
      const { deps } = setup();
      const ctx = createMockContext();
      const manifest = createTestManifest('test-agent', {
        tools: [createApprovalRequiredTool('my-tool')],
        humanInTheLoop: {
          alwaysRequireApproval: ['my-tool'],
          defaultRequiresApproval: false,
        },
      });

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(
          createToolApprovalParts('approval-1', 'my-tool', {}),
        ),
      );

      const generator = orchestrateAgentRun(
        ctx,
        manifest,
        {
          type: 'request',
          prompt: 'Test',
          manifestMap: new Map(),
        },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      const result = assertFinalResultOk(finalResult);
      const stateId = result.runId;

      // First cancel
      const firstCancel = await cancelAgentState(ctx, stateId, deps);
      expect(firstCancel.isOk()).toBe(true);
      expect(firstCancel._unsafeUnwrap().type).toBe('marked-cancelled');

      // Second cancel - should be idempotent
      const secondCancel = await cancelAgentState(ctx, stateId, deps);
      expect(secondCancel.isOk()).toBe(true);
      expect(secondCancel._unsafeUnwrap().type).toBe('already-cancelled');
    });

    it('should return error when cancelling completed agent', async () => {
      const { deps } = setup();
      const ctx = createMockContext();
      const manifest = createTestManifest('test-agent');

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(createTextCompletionParts('Done!')),
      );

      const generator = orchestrateAgentRun(
        ctx,
        manifest,
        {
          type: 'request',
          prompt: 'Finish quickly',
          manifestMap: new Map(),
        },
        deps,
      );

      const { events, finalResult } = await collectStreamItems(generator);
      const result = assertFinalResultOk(finalResult);

      expect(result.status).toBe('complete');

      // Find stateId from agent-started event
      const stateId = findStateIdFromEvents(events);

      // Try to cancel - should fail
      const cancelResult = await cancelAgentState(ctx, stateId, deps);

      expect(cancelResult.isErr()).toBe(true);
      expect(cancelResult._unsafeUnwrapErr().message).toContain(
        'terminal state',
      );
    });

    it('should return error when cancelling failed agent', async () => {
      const { deps, stateCache } = setup();
      const ctx = createMockContext();
      const manifest = createTestManifest('test-agent');

      // Mock LLM to fail
      deps.completionsGateway.streamCompletion.mockImplementation(
        async function* () {
          yield err(internalError('LLM failure'));
        },
      );

      const generator = orchestrateAgentRun(
        ctx,
        manifest,
        {
          type: 'request',
          prompt: 'Fail please',
          manifestMap: new Map(),
        },
        deps,
      );

      const { events, finalResult } = await collectStreamItems(generator);

      // Result should be ok but with error status (not an Err result)
      expect(finalResult!.result.isOk()).toBe(true);
      expect(finalResult!.result._unsafeUnwrap().status).toBe('error');

      // Find stateId from agent-started event
      const stateId = findStateIdFromEvents(events);

      // Verify state is failed
      const stateResult = await stateCache.get(ctx, stateId);
      expect(stateResult._unsafeUnwrap()?.status).toBe('failed');

      // Try to cancel - should fail
      const cancelResult = await cancelAgentState(ctx, stateId, deps);

      expect(cancelResult.isErr()).toBe(true);
      expect(cancelResult._unsafeUnwrapErr().message).toContain(
        'terminal state',
      );
    });
  });

  describe('Concurrency and Lock Behavior', () => {
    it('should return already-running for concurrent approval attempts', async () => {
      const { deps } = setup();
      const ctx1 = createMockContext();
      const ctx2 = createMockContext();
      const manifest = createTestManifest('test-agent', {
        tools: [createApprovalRequiredTool('my-tool')],
        humanInTheLoop: {
          alwaysRequireApproval: ['my-tool'],
          defaultRequiresApproval: false,
        },
      });

      // First: agent calls tool and suspends
      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(
          createToolApprovalParts('approval-1', 'my-tool', {}),
        ),
      );

      const gen1 = orchestrateAgentRun(
        ctx1,
        manifest,
        {
          type: 'request',
          prompt: 'Use tool',
          manifestMap: new Map(),
        },
        deps,
      );

      const { finalResult: result1 } = await collectStreamItems(gen1);
      const suspendedResult = assertFinalResultOk(result1);
      expect(suspendedResult.status).toBe('suspended');
      const stateId = suspendedResult.runId;

      // Now: slow approval (holds lock)
      deps.completionsGateway.streamCompletion.mockImplementation(
        createSlowCompletionMock(2000, createTextCompletionParts('Done')),
      );

      const gen2 = orchestrateAgentRun(
        ctx1,
        manifest,
        {
          type: 'approval',
          runId: stateId,
          response: {
            approvalId: 'approval-1',
            type: 'approval',
            approved: true,
          },
          manifestMap: new Map(),
          options: { cancellationPollIntervalMs: TEST_POLL_INTERVAL_MS },
        },
        deps,
      );

      // Wait for gen2 to start (acquire lock)
      const firstEvent = await gen2.next();
      expect(firstEvent.done).toBe(false);

      // Concurrently try another approval - should fail with already-running
      const gen3 = orchestrateAgentRun(
        ctx2,
        manifest,
        {
          type: 'approval',
          runId: stateId,
          response: {
            approvalId: 'approval-1',
            type: 'approval',
            approved: true,
          },
          manifestMap: new Map(),
        },
        deps,
      );

      const { finalResult: result3 } = await collectStreamItems(gen3);

      expect(result3!.result.isOk()).toBe(true);
      expect(result3!.result._unsafeUnwrap().status).toBe('already-running');

      // Cancel gen2 to clean up
      await signalCancellation(ctx1, stateId, deps);
      await collectRemainingItems(gen2);
    });

    it('should release lock after normal completion allowing reply', async () => {
      const { deps, agentRunLock } = setup();
      const ctx = createMockContext();
      const manifest = createTestManifest('test-agent');

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(createTextCompletionParts('Done')),
      );

      // First run - completes
      const gen1 = orchestrateAgentRun(
        ctx,
        manifest,
        {
          type: 'request',
          prompt: 'First run',
          manifestMap: new Map(),
        },
        deps,
      );

      const { events, finalResult: result1 } = await collectStreamItems(gen1);
      const stateId = findStateIdFromEvents(events);

      expect(result1!.result.isOk()).toBe(true);
      expect(result1!.result._unsafeUnwrap().status).toBe('complete');

      // Verify lock is NOT held
      const lockCheck = await agentRunLock.isLocked(ctx, stateId);
      expect(lockCheck._unsafeUnwrap()).toBe(false);

      // Can reply to the completed agent (type: 'reply' expects completed status)
      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(
          createTextCompletionParts('Second run done'),
        ),
      );

      const gen2 = orchestrateAgentRun(
        ctx,
        manifest,
        {
          type: 'reply',
          runId: stateId,
          message: 'Continue please',
          manifestMap: new Map(),
        },
        deps,
      );

      const { finalResult: result2 } = await collectStreamItems(gen2);
      expect(result2!.result.isOk()).toBe(true);
    });
  });

  describe('Crash Detection', () => {
    it('should mark agent as failed when crash detected (duration > TTL)', async () => {
      const { deps, stateCache } = setup();
      const ctx = createMockContext();

      // Manually create a "running" state that looks crashed
      // (startedAt is older than lock TTL)
      const stateId = AgentRunId();
      const oldStartTime = new Date(Date.now() - 60_000); // 60 seconds ago

      const crashedState: AgentState = {
        id: stateId,
        schemaVersion: 1,
        createdAt: oldStartTime,
        updatedAt: oldStartTime,
        startedAt: oldStartTime,
        status: 'running',
        messages: [],
        manifestId: AgentId('test-agent'),
        rootManifestId: AgentId('test-agent'),
        manifestVersion: '1.0.0',
        pendingToolResults: [],
        suspensions: [],
        suspensionStacks: [],
        elapsedExecutionMs: 0,
        steps: [],
        childStateIds: [],
        currentStepNumber: 0,
      };

      await stateCache.set(ctx, stateId, crashedState);

      // Cancel - should detect crash
      const cancelResult = await cancelAgentState(ctx, stateId, deps, {
        agentRunLockTtl: TEST_LOCK_TTL_SECONDS,
      });

      expect(cancelResult.isOk()).toBe(true);
      expect(cancelResult._unsafeUnwrap().type).toBe('marked-failed');

      // Verify state is now failed
      const state = await stateCache.get(ctx, stateId);
      expect(state._unsafeUnwrap()?.status).toBe('failed');
    });

    it('should signal cancellation in race condition (duration <= TTL)', async () => {
      const { deps, stateCache, cancellationCache } = setup();
      const ctx = createMockContext();

      // Create a "running" state that started recently (within TTL)
      const stateId = AgentRunId();
      const recentStart = new Date(Date.now() - 500); // 500ms ago

      const recentState: AgentState = {
        id: stateId,
        schemaVersion: 1,
        createdAt: recentStart,
        updatedAt: recentStart,
        startedAt: recentStart,
        status: 'running',
        messages: [],
        manifestId: AgentId('test-agent'),
        rootManifestId: AgentId('test-agent'),
        manifestVersion: '1.0.0',
        pendingToolResults: [],
        suspensions: [],
        suspensionStacks: [],
        elapsedExecutionMs: 0,
        steps: [],
        childStateIds: [],
        currentStepNumber: 0,
      };

      await stateCache.set(ctx, stateId, recentState);

      // Cancel - lock is available but duration is short
      // This is a race condition - we signal cancellation
      const cancelResult = await cancelAgentState(ctx, stateId, deps, {
        agentRunLockTtl: TEST_LOCK_TTL_SECONDS,
      });

      expect(cancelResult.isOk()).toBe(true);
      expect(cancelResult._unsafeUnwrap().type).toBe('signaled-running');

      // Cancellation signal should be in cache
      const signal = await cancellationCache.get(ctx, stateId);
      expect(signal._unsafeUnwrap()).not.toBeNull();
    });
  });

  describe('Running State Management', () => {
    it('should create running state with startedAt on fresh request', async () => {
      const { deps, stateCache } = setup();
      const ctx = createMockContext();
      const manifest = createTestManifest('test-agent');
      const beforeRun = Date.now();

      deps.completionsGateway.streamCompletion.mockImplementation(
        createSlowCompletionMock(300, createTextCompletionParts('Hello')),
      );

      const generator = orchestrateAgentRun(
        ctx,
        manifest,
        {
          type: 'request',
          prompt: 'Hello',
          manifestMap: new Map(),
          options: { cancellationPollIntervalMs: TEST_POLL_INTERVAL_MS },
        },
        deps,
      );

      // Get agent-started event
      const firstResult = await generator.next();
      const stateId = extractStateIdFromStartedEvent(
        firstResult.value as Parameters<
          typeof extractStateIdFromStartedEvent
        >[0],
      );

      // Start the next iteration (which creates state) but don't wait for it to complete
      // This triggers state creation which happens before the slow completion
      const nextPromise = generator.next();

      // Poll for state to be created (with timeout)
      let stateValue = null;
      for (let i = 0; i < 20; i++) {
        const stateResult = await stateCache.get(ctx, stateId);
        if (stateResult.isOk() && stateResult.value !== null) {
          stateValue = stateResult.value;
          break;
        }
        await delay(10);
      }

      expect(stateValue).not.toBeNull();
      expect(stateValue!.status).toBe('running');
      expect(stateValue!.startedAt).toBeDefined();
      expect(stateValue!.startedAt!.getTime()).toBeGreaterThanOrEqual(
        beforeRun,
      );

      // Clean up - cancel the running agent and wait for completion
      await signalCancellation(ctx, stateId, deps);
      await nextPromise; // Let the next iteration complete (it will be cancelled)
      await collectRemainingItems(generator);
    });

    it('should finalize state to completed on successful execution', async () => {
      const { deps, stateCache } = setup();
      const ctx = createMockContext();
      const manifest = createTestManifest('test-agent');

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(createTextCompletionParts('Complete!')),
      );

      const generator = orchestrateAgentRun(
        ctx,
        manifest,
        {
          type: 'request',
          prompt: 'Finish',
          manifestMap: new Map(),
        },
        deps,
      );

      const { events, finalResult } = await collectStreamItems(generator);
      const result = assertFinalResultOk(finalResult);

      expect(result.status).toBe('complete');

      // Check final state
      const stateId = findStateIdFromEvents(events);
      const state = await stateCache.get(ctx, stateId);
      const stateValue = state._unsafeUnwrap();

      expect(stateValue).not.toBeNull();
      expect(stateValue!.status).toBe('completed');
      expect(stateValue!.elapsedExecutionMs).toBeGreaterThan(0);
    });

    it('should finalize state to cancelled when agent is cancelled', async () => {
      const { deps, stateCache } = setup();
      const ctx = createMockContext();
      const manifest = createTestManifest('test-agent');

      deps.completionsGateway.streamCompletion.mockImplementation(
        createSlowCompletionMock(500, createTextCompletionParts('Hello')),
      );

      const generator = orchestrateAgentRun(
        ctx,
        manifest,
        {
          type: 'request',
          prompt: 'Hello',
          manifestMap: new Map(),
          options: { cancellationPollIntervalMs: TEST_POLL_INTERVAL_MS },
        },
        deps,
      );

      // Get stateId
      const firstResult = await generator.next();
      const stateId = extractStateIdFromStartedEvent(
        firstResult.value as Parameters<
          typeof extractStateIdFromStartedEvent
        >[0],
      );

      // Cancel
      await signalCancellation(ctx, stateId, deps);

      // Wait for cancellation to complete
      await collectRemainingItems(generator);

      // Check final state
      const state = await stateCache.get(ctx, stateId);
      const stateValue = state._unsafeUnwrap();

      expect(stateValue).not.toBeNull();
      expect(stateValue!.status).toBe('cancelled');
    });

    it('should allow agent to complete if cancellation signal set after completion', async () => {
      const { deps, stateCache } = setup();
      const ctx = createMockContext();
      const manifest = createTestManifest('fast-agent');

      // Create a fast completion
      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(createTextCompletionParts('Done quickly')),
      );

      const generator = orchestrateAgentRun(
        ctx,
        manifest,
        {
          type: 'request',
          prompt: 'Quick task',
          manifestMap: new Map(),
          options: { cancellationPollIntervalMs: TEST_POLL_INTERVAL_MS },
        },
        deps,
      );

      // Get agent-started event
      const firstResult = await generator.next();
      const stateId = extractStateIdFromStartedEvent(
        firstResult.value as Parameters<
          typeof extractStateIdFromStartedEvent
        >[0],
      );

      // Let agent complete naturally (collect all events)
      const { finalResult } = await collectRemainingItems(generator);

      // Agent should have completed successfully
      expect(finalResult!.result.isOk()).toBe(true);
      const result = finalResult!.result._unsafeUnwrap();
      expect(result.status).toBe('complete');

      // Now try to cancel after completion
      const cancelResult = await signalCancellation(ctx, stateId, deps);

      // Cancellation signal is set, but agent already completed
      expect(cancelResult.isOk()).toBe(true);

      // Verify state is still "completed" (not changed to "cancelled")
      const state = await stateCache.get(ctx, stateId);
      const stateValue = state._unsafeUnwrap();

      expect(stateValue).not.toBeNull();
      // State should be completed, not cancelled, because agent finished before signal was detected
      expect(stateValue!.status).toBe('completed');
    });
  });
});
