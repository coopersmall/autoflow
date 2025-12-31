/**
 * Integration tests for the Unified Streaming Architecture.
 *
 * Tests the complete streaming agent execution with real infrastructure:
 * - Real PostgreSQL database for persistence
 * - Real Redis cache for agent state
 * - Mocked completionsGateway to control LLM responses
 *
 * These tests verify:
 * - Single agent streaming (text-delta, tool-call, tool-result events)
 * - Event metadata (manifestId, timestamps, parentManifestId)
 * - Sub-agent event streaming and propagation
 * - Suspension handling
 * - Parallel tool execution
 */

import { describe, expect, it } from 'bun:test';
import type { AgentManifest } from '@backend/agents/domain';
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
import {
  type AgentEvent,
  type AgentExecuteFunction,
  AgentId,
  type AgentRunResult,
} from '@core/domain/agents';
import type { StreamPart } from '@core/domain/ai';
import type { AppError } from '@core/errors/AppError';
import * as fc from 'fast-check';
import { err, ok, type Result } from 'neverthrow';
import {
  type StreamAgentFinalResult,
  type StreamAgentItem,
  streamAgent,
} from '../streamAgent';
import {
  agentIdArb,
  createManifestMap,
  createTestManifest,
  createTextCompletionParts,
  createToolApprovalParts,
  createToolCallCompletionParts,
  parentChildManifestArb,
  simpleTextArb,
  streamableEventTypesArb,
  toolsArb,
  versionArb,
} from './fixtures';

// =============================================================================
// Test Setup
// =============================================================================

describe('Unified Streaming Architecture Integration Tests', () => {
  const { getConfig, getLogger } = setupIntegrationTest();

  /**
   * Setup function that creates real infrastructure for each test.
   */
  const setup = () => {
    const config = getConfig();
    const logger = getLogger();

    // Real infrastructure
    const stateCache = createAgentStateCache({ appConfig: config, logger });
    const agentRunLock = createAgentRunLock({ appConfig: config, logger });
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
    };
  };

  /**
   * Creates an async generator that yields stream parts.
   */
  function createMockStreamCompletion(
    parts: StreamPart[],
  ): () => AsyncGenerator<Result<StreamPart, AppError>> {
    return async function* () {
      for (const part of parts) {
        yield ok(part);
      }
    };
  }

  /**
   * Creates a mock stream completion that returns multiple sequences.
   * Each call to streamCompletion returns the next sequence.
   */
  function createMockStreamCompletionSequence(
    sequences: StreamPart[][],
  ): () => AsyncGenerator<Result<StreamPart, AppError>> {
    let callIndex = 0;

    return () => {
      const parts = sequences[callIndex] ?? [];
      callIndex++;

      async function* generate() {
        for (const part of parts) {
          yield ok(part);
        }
      }

      return generate();
    };
  }

  /**
   * Collects all items from a streamAgent generator.
   */
  async function collectStreamItems(
    generator: AsyncGenerator<StreamAgentItem, void>,
  ): Promise<{
    events: AgentEvent[];
    errors: AppError[];
    finalResult: StreamAgentFinalResult | undefined;
  }> {
    const events: AgentEvent[] = [];
    const errors: AppError[] = [];
    let finalResult: StreamAgentFinalResult | undefined;

    for await (const item of generator) {
      if ('type' in item && item.type === 'final') {
        finalResult = item;
      } else if ('isOk' in item) {
        if (item.isOk()) {
          events.push(item.value);
        } else {
          errors.push(item.error);
        }
      }
    }

    return { events, errors, finalResult };
  }

  /**
   * Asserts that the final result exists and extracts the AgentRunResult.
   * Fails the test if finalResult is undefined or if the Result is an error.
   */
  function assertFinalResultOk(
    finalResult: StreamAgentFinalResult | undefined,
  ): AgentRunResult {
    expect(finalResult).toBeDefined();
    const result = finalResult!.result;
    expect(result.isOk()).toBe(true);
    return result._unsafeUnwrap();
  }

  // ===========================================================================
  // Single Agent Streaming Tests
  // ===========================================================================

  describe('Single Agent Streaming', () => {
    it('should yield text-delta events during LLM streaming', async () => {
      const ctx = createMockContext();
      const { deps } = setup();
      const manifest = createTestManifest('test-agent', {
        streamingEvents: ['text-delta'],
      });

      const parts = createTextCompletionParts('Hello, world!');
      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(parts),
      );

      const generator = streamAgent(
        ctx,
        manifest,
        {
          type: 'request',
          prompt: 'Say hello',
          manifestMap: new Map(),
        },
        deps,
      );

      const { events, finalResult } = await collectStreamItems(generator);

      const textDeltas = events.filter((e) => e.type === 'text-delta');
      expect(textDeltas.length).toBeGreaterThan(0);
      expect(textDeltas[0].type).toBe('text-delta');

      const agentResult = assertFinalResultOk(finalResult);
      expect(agentResult.status).toBe('complete');
    });

    it('should yield tool-call events when tools are called', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      const toolExecutors: Record<string, AgentExecuteFunction> = {
        'test-tool': async () => ({
          type: 'success',
          output: { result: 'success' },
        }),
      };

      const manifest = createTestManifest('test-agent', {
        streamingEvents: ['tool-call', 'tool-result'],
        tools: [
          {
            type: 'function',
            function: {
              name: 'test-tool',
              description: 'A test tool',
              parameters: {
                type: 'object',
                properties: { arg: { type: 'string' } },
              },
            },
          },
        ],
        toolExecutors,
      });

      const toolCallParts = createToolCallCompletionParts(
        'test-tool',
        'call-1',
        { arg: 'value' },
      );
      const completionParts = createTextCompletionParts('Done!');

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletionSequence([toolCallParts, completionParts]),
      );

      const generator = streamAgent(
        ctx,
        manifest,
        {
          type: 'request',
          prompt: 'Use the tool',
          manifestMap: new Map(),
        },
        deps,
      );

      const { events, finalResult } = await collectStreamItems(generator);

      const toolCalls = events.filter((e) => e.type === 'tool-call');
      expect(toolCalls.length).toBeGreaterThan(0);

      const toolResults = events.filter((e) => e.type === 'tool-result');
      expect(toolResults.length).toBeGreaterThan(0);

      assertFinalResultOk(finalResult);
    });

    it('should include manifestId on all events', async () => {
      const ctx = createMockContext();
      const { deps } = setup();
      const manifest = createTestManifest('my-agent', {
        streamingEvents: ['text-delta', 'tool-call', 'tool-result'],
      });

      const parts = createTextCompletionParts('Hello!');
      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(parts),
      );

      const generator = streamAgent(
        ctx,
        manifest,
        {
          type: 'request',
          prompt: 'Hello',
          manifestMap: new Map(),
        },
        deps,
      );

      const { events } = await collectStreamItems(generator);

      // Ensure we have events to check
      expect(events.length).toBeGreaterThan(0);

      // Check all events have correct manifestId
      const eventsWithWrongManifestId = events.filter(
        (e) => e.manifestId !== AgentId('my-agent'),
      );
      expect(eventsWithWrongManifestId).toEqual([]);
    });

    it('should yield agent-done event on successful completion', async () => {
      const ctx = createMockContext();
      const { deps } = setup();
      const manifest = createTestManifest('test-agent');

      const parts = createTextCompletionParts('Complete!');
      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(parts),
      );

      const generator = streamAgent(
        ctx,
        manifest,
        {
          type: 'request',
          prompt: 'Complete the task',
          manifestMap: new Map(),
        },
        deps,
      );

      const { events } = await collectStreamItems(generator);

      const doneEvents = events.filter((e) => e.type === 'agent-done');
      expect(doneEvents.length).toBe(1);
      expect(doneEvents[0].type).toBe('agent-done');
    });

    it('should yield agent-error event on error', async () => {
      const ctx = createMockContext();
      const { deps } = setup();
      const manifest = createTestManifest('test-agent');

      deps.completionsGateway.streamCompletion.mockImplementation(
        async function* (): AsyncGenerator<Result<StreamPart, AppError>> {
          yield ok({ type: 'start' });
          yield ok({
            type: 'start-step',
            request: { body: undefined },
            warnings: [],
          });
          yield err({
            code: 'InternalServer',
            name: 'TestError',
            message: 'Something went wrong',
            metadata: {},
          });
        },
      );

      const generator = streamAgent(
        ctx,
        manifest,
        {
          type: 'request',
          prompt: 'This will fail',
          manifestMap: new Map(),
        },
        deps,
      );

      const { events, finalResult } = await collectStreamItems(generator);

      const errorEvents = events.filter((e) => e.type === 'agent-error');
      expect(errorEvents.length).toBe(1);

      const agentResult = assertFinalResultOk(finalResult);
      expect(agentResult.status).toBe('error');
    });

    it('should filter events based on manifest streaming config', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      const toolExecutors: Record<string, AgentExecuteFunction> = {
        'test-tool': async () => ({
          type: 'success',
          output: { result: 'ok' },
        }),
      };

      // Only allow text-delta, not tool-call
      const manifest = createTestManifest('test-agent', {
        streamingEvents: ['text-delta'],
        tools: [
          {
            type: 'function',
            function: {
              name: 'test-tool',
              description: 'A test tool',
              parameters: { type: 'object', properties: {} },
            },
          },
        ],
        toolExecutors,
      });

      const toolCallParts = createToolCallCompletionParts(
        'test-tool',
        'call-1',
        {},
      );
      const completionParts = createTextCompletionParts('Done!');

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletionSequence([toolCallParts, completionParts]),
      );

      const generator = streamAgent(
        ctx,
        manifest,
        {
          type: 'request',
          prompt: 'Use tool',
          manifestMap: new Map(),
        },
        deps,
      );

      const { events } = await collectStreamItems(generator);

      const textDeltas = events.filter((e) => e.type === 'text-delta');
      expect(textDeltas.length).toBeGreaterThan(0);

      const toolCalls = events.filter((e) => e.type === 'tool-call');
      expect(toolCalls.length).toBe(0);
    });
  });

  // ===========================================================================
  // Event Timestamps Tests
  // ===========================================================================

  describe('Event Timestamps', () => {
    it('should include timestamps on all events', async () => {
      const ctx = createMockContext();
      const { deps } = setup();
      const manifest = createTestManifest('test-agent', {
        streamingEvents: ['text-delta'],
      });

      const parts = createTextCompletionParts('Hello!');
      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(parts),
      );

      const before = Date.now();

      const generator = streamAgent(
        ctx,
        manifest,
        {
          type: 'request',
          prompt: 'Hello',
          manifestMap: new Map(),
        },
        deps,
      );

      const { events } = await collectStreamItems(generator);

      const after = Date.now();

      // Ensure we have events to check
      expect(events.length).toBeGreaterThan(0);

      // Check all events have valid timestamps
      const eventsWithInvalidTimestamp = events.filter(
        (e) => e.timestamp < before || e.timestamp > after,
      );
      expect(eventsWithInvalidTimestamp).toEqual([]);
    });
  });

  // ===========================================================================
  // Multiple Steps Tests
  // ===========================================================================

  describe('Multiple Steps', () => {
    it('should yield events for each step in multi-step execution', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      const toolExecutors: Record<string, AgentExecuteFunction> = {
        'step-tool': async () => ({
          type: 'success',
          output: { done: true },
        }),
      };

      const manifest = createTestManifest('test-agent', {
        streamingEvents: ['text-delta', 'tool-call', 'tool-result'],
        tools: [
          {
            type: 'function',
            function: {
              name: 'step-tool',
              description: 'Step tool',
              parameters: { type: 'object', properties: {} },
            },
          },
        ],
        toolExecutors,
      });

      const step1Parts = createToolCallCompletionParts(
        'step-tool',
        'call-1',
        {},
      );
      const step2Parts = createTextCompletionParts('All done!');

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletionSequence([step1Parts, step2Parts]),
      );

      const generator = streamAgent(
        ctx,
        manifest,
        {
          type: 'request',
          prompt: 'Multi-step task',
          manifestMap: new Map(),
        },
        deps,
      );

      const { events } = await collectStreamItems(generator);

      const toolCalls = events.filter((e) => e.type === 'tool-call');
      const textDeltas = events.filter((e) => e.type === 'text-delta');

      expect(toolCalls.length).toBeGreaterThan(0);
      expect(textDeltas.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Sub-Agent Event Streaming Tests
  // ===========================================================================

  describe('Sub-Agent Event Streaming', () => {
    it('should yield sub-agent-start and sub-agent-end events', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      const childManifest = createTestManifest('child-agent', {
        streamingEvents: ['text-delta'],
      });
      const parentManifest = createTestManifest('parent-agent', {
        streamingEvents: ['text-delta', 'tool-call', 'tool-result'],
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

      const toolCallParts = createToolCallCompletionParts(
        'invoke-child',
        'call-1',
        { prompt: 'Do child task' },
      );
      const childCompletionParts = createTextCompletionParts('Child done!');
      const parentCompletionParts = createTextCompletionParts('Parent done!');

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletionSequence([
          toolCallParts,
          childCompletionParts,
          parentCompletionParts,
        ]),
      );

      const generator = streamAgent(
        ctx,
        parentManifest,
        {
          type: 'request',
          prompt: 'Start the task',
          manifestMap,
        },
        deps,
      );

      const { events, finalResult } = await collectStreamItems(generator);

      const startEvents = events.filter(
        (e): e is AgentEvent & { type: 'sub-agent-start' } =>
          e.type === 'sub-agent-start',
      );
      expect(startEvents.length).toBe(1);
      expect(startEvents[0].subAgentManifestId).toBe(AgentId('child-agent'));
      expect(startEvents[0].subAgentToolName).toBe('invoke-child');

      const endEvents = events.filter(
        (e): e is AgentEvent & { type: 'sub-agent-end' } =>
          e.type === 'sub-agent-end',
      );
      expect(endEvents.length).toBe(1);
      expect(endEvents[0].subAgentManifestId).toBe(AgentId('child-agent'));
      expect(endEvents[0].status).toBe('complete');

      assertFinalResultOk(finalResult);
    });

    it('should set parentManifestId on child events', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      const childManifest = createTestManifest('child-agent', {
        streamingEvents: ['text-delta'],
      });
      const parentManifest = createTestManifest('parent-agent', {
        streamingEvents: ['text-delta', 'tool-call'],
        subAgents: [
          {
            manifestId: AgentId('child-agent'),
            manifestVersion: '1.0.0',
            name: 'invoke-child',
            description: 'Invoke child',
          },
        ],
      });

      const manifestMap = createManifestMap([childManifest, parentManifest]);

      const toolCallParts = createToolCallCompletionParts(
        'invoke-child',
        'call-1',
        { prompt: 'Task' },
      );
      const childParts = createTextCompletionParts('Child text');
      const parentDoneParts = createTextCompletionParts('Parent done');

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletionSequence([
          toolCallParts,
          childParts,
          parentDoneParts,
        ]),
      );

      const generator = streamAgent(
        ctx,
        parentManifest,
        {
          type: 'request',
          prompt: 'Start',
          manifestMap,
        },
        deps,
      );

      const { events } = await collectStreamItems(generator);

      const childTextDeltas = events.filter(
        (e) =>
          e.type === 'text-delta' && e.manifestId === AgentId('child-agent'),
      );

      // Ensure we have child events to check
      expect(childTextDeltas.length).toBeGreaterThan(0);

      // Check all child events have correct parentManifestId
      const eventsWithWrongParent = childTextDeltas.filter(
        (e) => e.parentManifestId !== AgentId('parent-agent'),
      );
      expect(eventsWithWrongParent).toEqual([]);
    });

    it('should handle 3-level deep nesting (root -> middle -> leaf)', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      const leafManifest = createTestManifest('leaf-agent', {
        streamingEvents: ['text-delta'],
      });
      const middleManifest = createTestManifest('middle-agent', {
        streamingEvents: ['text-delta'],
        subAgents: [
          {
            manifestId: AgentId('leaf-agent'),
            manifestVersion: '1.0.0',
            name: 'invoke-leaf',
            description: 'Invoke leaf agent',
          },
        ],
      });
      const rootManifest = createTestManifest('root-agent', {
        streamingEvents: ['text-delta', 'tool-call'],
        subAgents: [
          {
            manifestId: AgentId('middle-agent'),
            manifestVersion: '1.0.0',
            name: 'invoke-middle',
            description: 'Invoke middle agent',
          },
        ],
      });

      const manifestMap = createManifestMap([
        leafManifest,
        middleManifest,
        rootManifest,
      ]);

      const rootCallsMiddle = createToolCallCompletionParts(
        'invoke-middle',
        'call-1',
        { prompt: 'Do middle task' },
      );
      const middleCallsLeaf = createToolCallCompletionParts(
        'invoke-leaf',
        'call-2',
        { prompt: 'Do leaf task' },
      );
      const leafCompletes = createTextCompletionParts('Leaf done!');
      const middleCompletes = createTextCompletionParts('Middle done!');
      const rootCompletes = createTextCompletionParts('Root done!');

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletionSequence([
          rootCallsMiddle,
          middleCallsLeaf,
          leafCompletes,
          middleCompletes,
          rootCompletes,
        ]),
      );

      const generator = streamAgent(
        ctx,
        rootManifest,
        {
          type: 'request',
          prompt: 'Start',
          manifestMap,
        },
        deps,
      );

      const { events, finalResult } = await collectStreamItems(generator);

      const subAgentStarts = events.filter((e) => e.type === 'sub-agent-start');
      expect(subAgentStarts.length).toBe(2);

      const subAgentEnds = events.filter((e) => e.type === 'sub-agent-end');
      expect(subAgentEnds.length).toBe(2);

      assertFinalResultOk(finalResult);
    });
  });

  // ===========================================================================
  // Streaming Suspend Tests
  // ===========================================================================

  describe('Streaming Suspend and Resume', () => {
    it('should yield agent-suspended event when tool requires approval', async () => {
      const ctx = createMockContext();
      const { deps } = setup();
      const manifest = createTestManifest('test-agent');

      const suspendParts = createToolApprovalParts(
        'approval-123',
        'sensitive-tool',
        { action: 'delete' },
      );

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(suspendParts),
      );

      const generator = streamAgent(
        ctx,
        manifest,
        {
          type: 'request',
          prompt: 'Perform sensitive action',
          manifestMap: new Map(),
        },
        deps,
      );

      const { events, finalResult } = await collectStreamItems(generator);

      const suspendedEvents = events.filter(
        (e) => e.type === 'agent-suspended',
      );
      expect(suspendedEvents.length).toBe(1);

      const agentResult = assertFinalResultOk(finalResult);
      expect(agentResult.status).toBe('suspended');
    });
  });

  // ===========================================================================
  // Parallel Tool Execution Tests
  // ===========================================================================

  describe('Parallel Tool Execution', () => {
    it('should execute multiple tools in parallel and yield tool-result events', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      const toolExecutors: Record<string, AgentExecuteFunction> = {
        'tool-a': async () => ({
          type: 'success',
          output: { result: 'a-result' },
        }),
        'tool-b': async () => ({
          type: 'success',
          output: { result: 'b-result' },
        }),
      };

      const manifest = createTestManifest('test-agent', {
        streamingEvents: ['tool-call', 'tool-result'],
        tools: [
          {
            type: 'function',
            function: {
              name: 'tool-a',
              description: 'Tool A',
              parameters: { type: 'object', properties: {} },
            },
          },
          {
            type: 'function',
            function: {
              name: 'tool-b',
              description: 'Tool B',
              parameters: { type: 'object', properties: {} },
            },
          },
        ],
        toolExecutors,
      });

      const now = new Date();
      const multiToolParts: StreamPart[] = [
        { type: 'start' },
        {
          type: 'start-step',
          request: { body: undefined },
          warnings: [],
        },
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'tool-a',
          input: { id: 1 },
        },
        {
          type: 'tool-call',
          toolCallId: 'call-2',
          toolName: 'tool-b',
          input: { id: 2 },
        },
        {
          type: 'finish-step',
          response: {
            id: 'resp-1',
            timestamp: now,
            modelId: 'claude-3-5-sonnet-20241022',
          },
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          finishReason: 'tool-calls',
        },
        {
          type: 'finish',
          finishReason: 'tool-calls',
          totalUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        },
      ];

      const completionParts = createTextCompletionParts('Both tools done!');

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletionSequence([multiToolParts, completionParts]),
      );

      const generator = streamAgent(
        ctx,
        manifest,
        {
          type: 'request',
          prompt: 'Call both tools',
          manifestMap: new Map(),
        },
        deps,
      );

      const { events, finalResult } = await collectStreamItems(generator);

      const toolCalls = events.filter((e) => e.type === 'tool-call');
      expect(toolCalls.length).toBe(2);

      const toolResults = events.filter((e) => e.type === 'tool-result');
      expect(toolResults.length).toBe(2);

      const toolResultNames = toolResults.map((e) =>
        e.type === 'tool-result' ? e.toolName : '',
      );
      expect(toolResultNames).toContain('tool-a');
      expect(toolResultNames).toContain('tool-b');

      assertFinalResultOk(finalResult);
    });
  });

  // ===========================================================================
  // Property-Based Tests
  // ===========================================================================

  describe('Property Tests', () => {
    it('should always include manifestId on events for any agent ID and version', async () => {
      const { deps } = setup();

      await fc.assert(
        fc.asyncProperty(
          agentIdArb,
          versionArb,
          simpleTextArb,
          async (agentId, version, text) => {
            const ctx = createMockContext();
            const manifest = createTestManifest(agentId, {
              version,
              streamingEvents: ['text-delta'],
            });

            const parts = createTextCompletionParts(text);
            deps.completionsGateway.streamCompletion.mockImplementation(
              createMockStreamCompletion(parts),
            );

            const generator = streamAgent(
              ctx,
              manifest,
              {
                type: 'request',
                prompt: 'Test',
                manifestMap: new Map(),
              },
              deps,
            );

            const { events } = await collectStreamItems(generator);

            // Ensure we have events to check
            expect(events.length).toBeGreaterThan(0);

            // Check all events have correct manifestId
            const eventsWithWrongManifestId = events.filter(
              (e) => e.manifestId !== AgentId(agentId),
            );
            expect(eventsWithWrongManifestId).toEqual([]);
          },
        ),
        { numRuns: 10 },
      );
    });

    it('should always return a final result for any agent ID and version', async () => {
      const { deps } = setup();

      await fc.assert(
        fc.asyncProperty(
          agentIdArb,
          versionArb,
          simpleTextArb,
          async (agentId, version, text) => {
            const ctx = createMockContext();
            const manifest = createTestManifest(agentId, { version });

            const parts = createTextCompletionParts(text);
            deps.completionsGateway.streamCompletion.mockImplementation(
              createMockStreamCompletion(parts),
            );

            const generator = streamAgent(
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

            expect(finalResult).toBeDefined();
            expect(finalResult!.type).toBe('final');
          },
        ),
        { numRuns: 10 },
      );
    });

    it('should respect event filtering for arbitrary event type configs', async () => {
      const { deps } = setup();

      await fc.assert(
        fc.asyncProperty(
          agentIdArb,
          streamableEventTypesArb,
          async (agentId, allowedEvents) => {
            const ctx = createMockContext();
            const manifest = createTestManifest(agentId, {
              streamingEvents: allowedEvents,
            });

            const parts = createTextCompletionParts('Hello');
            deps.completionsGateway.streamCompletion.mockImplementation(
              createMockStreamCompletion(parts),
            );

            const generator = streamAgent(
              ctx,
              manifest,
              {
                type: 'request',
                prompt: 'Test',
                manifestMap: new Map(),
              },
              deps,
            );

            const { events } = await collectStreamItems(generator);

            // Ensure we have events to check
            expect(events.length).toBeGreaterThan(0);

            // Lifecycle events are always emitted regardless of config
            const lifecycleEventTypes: string[] = [
              'agent-started',
              'agent-done',
              'agent-error',
              'agent-suspended',
              'agent-cancelled',
              'sub-agent-start',
              'sub-agent-end',
            ];

            // Configurable event types
            const allowedEventSet = new Set<string>(allowedEvents);

            // Find any configurable events that violate the filter
            const disallowedEvents = events.filter((event) => {
              const isLifecycleEvent = lifecycleEventTypes.includes(event.type);
              if (isLifecycleEvent) return false;
              return !allowedEventSet.has(event.type);
            });
            expect(disallowedEvents).toEqual([]);
          },
        ),
        { numRuns: 10 },
      );
    });

    it('should set parentManifestId on child events for arbitrary parent-child pairs', async () => {
      const { deps } = setup();

      await fc.assert(
        fc.asyncProperty(parentChildManifestArb, async ({ parent, child }) => {
          const ctx = createMockContext();
          const manifestMap = createManifestMap([parent, child]);

          const subAgentConfig = parent.config.subAgents?.[0];
          if (!subAgentConfig) return;

          const toolCallParts = createToolCallCompletionParts(
            subAgentConfig.name,
            'call-1',
            { prompt: 'Task' },
          );
          const childParts = createTextCompletionParts('Child done');
          const parentDoneParts = createTextCompletionParts('Parent done');

          deps.completionsGateway.streamCompletion.mockImplementation(
            createMockStreamCompletionSequence([
              toolCallParts,
              childParts,
              parentDoneParts,
            ]),
          );

          const generator = streamAgent(
            ctx,
            parent,
            {
              type: 'request',
              prompt: 'Go',
              manifestMap,
            },
            deps,
          );

          const { events } = await collectStreamItems(generator);

          const childEvents = events.filter(
            (e) => e.manifestId === child.config.id,
          );

          // Ensure we have child events to check
          expect(childEvents.length).toBeGreaterThan(0);

          // Check all child events have correct parentManifestId
          const eventsWithWrongParent = childEvents.filter(
            (e) => e.parentManifestId !== parent.config.id,
          );
          expect(eventsWithWrongParent).toEqual([]);
        }),
        { numRuns: 10 },
      );
    });

    it('should handle tools with arbitrary names and produce matching events', async () => {
      const { deps } = setup();

      await fc.assert(
        fc.asyncProperty(agentIdArb, toolsArb, async (agentId, tools) => {
          if (tools.length === 0) return;

          const ctx = createMockContext();

          const toolExecutors: Record<string, AgentExecuteFunction> = {};
          const toolDefinitions: NonNullable<AgentManifest['config']['tools']> =
            [];

          for (const tool of tools) {
            toolExecutors[tool.name] = tool.executor;
            toolDefinitions.push(tool.definition);
          }

          const manifest = createTestManifest(agentId, {
            streamingEvents: ['tool-call', 'tool-result'],
            tools: toolDefinitions,
            toolExecutors,
          });

          // Call the first tool
          const firstTool = tools[0];
          const toolCallParts = createToolCallCompletionParts(
            firstTool.name,
            'call-1',
            {},
          );
          const completionParts = createTextCompletionParts('Done');

          deps.completionsGateway.streamCompletion.mockImplementation(
            createMockStreamCompletionSequence([
              toolCallParts,
              completionParts,
            ]),
          );

          const generator = streamAgent(
            ctx,
            manifest,
            {
              type: 'request',
              prompt: 'Use tool',
              manifestMap: new Map(),
            },
            deps,
          );

          const { events, finalResult } = await collectStreamItems(generator);

          const toolCallEvents = events.filter((e) => e.type === 'tool-call');
          expect(toolCallEvents.length).toBeGreaterThan(0);

          const toolResultEvents = events.filter(
            (e) => e.type === 'tool-result',
          );
          expect(toolResultEvents.length).toBeGreaterThan(0);

          assertFinalResultOk(finalResult);
        }),
        { numRuns: 10 },
      );
    });
  });
});
