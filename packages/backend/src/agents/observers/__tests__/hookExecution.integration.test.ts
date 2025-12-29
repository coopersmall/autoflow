/**
 * Integration tests for Agent Hook Execution.
 *
 * Tests the hook infrastructure with real infrastructure:
 * - Real PostgreSQL database for persistence
 * - Real Redis cache for agent state
 * - Mocked completionsGateway to control LLM responses
 *
 * These tests verify:
 * - Hook execution order (observers before manifest hooks)
 * - Hook error handling (errors abort the run)
 * - Parent context passed to hooks for sub-agents
 * - State exists in cache when hooks fire
 */

import { describe, expect, it } from 'bun:test';
import {
  createManifestMap,
  createTestManifest,
  createTextCompletionParts,
  createToolCallCompletionParts,
} from '@backend/agents/actions/__tests__/fixtures';
import {
  type StreamAgentFinalResult,
  type StreamAgentItem,
  streamAgent,
} from '@backend/agents/actions/streamAgent';
import type { AgentManifest } from '@backend/agents/domain';
import {
  createAgentCancellationCache,
  createAgentStateCache,
} from '@backend/agents/infrastructure/cache';
import { createAgentRunLock } from '@backend/agents/infrastructure/lock';
import type { AgentObserver } from '@backend/agents/observers/AgentObserver';
import { applyObservers } from '@backend/agents/observers/utils';
import { getMockedCompletionsGateway } from '@backend/ai/completions/__mocks__/CompletionsGateway.mock';
import { getMockedMCPService } from '@backend/ai/mcp/services/__mocks__/MCPService.mock';
import { createMockContext } from '@backend/infrastructure/context/__mocks__/Context.mock';
import { createStorageService } from '@backend/storage/services/StorageService';
import { setupIntegrationTest } from '@backend/testing/integration/integrationTest';
import { TestServices } from '@backend/testing/integration/setup/TestServices';
import {
  type AgentEvent,
  AgentId,
  type AgentRunId,
  type AgentRunResult,
} from '@core/domain/agents';
import type { StreamPart } from '@core/domain/ai';
import type { AppError } from '@core/errors/AppError';
import { internalError } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';

describe('Hook Execution Integration Tests', () => {
  const { getConfig, getLogger } = setupIntegrationTest();

  const setup = () => {
    const config = getConfig();
    const logger = getLogger();

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
    };
  };

  function createMockStreamCompletion(
    parts: StreamPart[],
  ): () => AsyncGenerator<Result<StreamPart, AppError>> {
    return async function* () {
      for (const part of parts) {
        yield ok(part);
      }
    };
  }

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

  function assertFinalResultOk(
    finalResult: StreamAgentFinalResult | undefined,
  ): AgentRunResult {
    expect(finalResult).toBeDefined();
    const result = finalResult!.result;
    expect(result.isOk()).toBe(true);
    return result._unsafeUnwrap();
  }

  // ===========================================================================
  // Hook Execution Order Tests
  // ===========================================================================

  describe('Hook Execution Order', () => {
    it('should call observers before manifest hooks', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      const callOrder: string[] = [];

      // Create observer that records call order
      const observer: AgentObserver = {
        createHooks: () =>
          ok({
            onAgentStart: async () => {
              callOrder.push('observer-start');
              return ok(undefined);
            },
            onAgentComplete: async () => {
              callOrder.push('observer-complete');
              return ok(undefined);
            },
          }),
      };

      // Create manifest with hooks that record call order
      const baseManifest = createTestManifest('test-agent');
      const manifestWithHooks: AgentManifest = {
        ...baseManifest,
        hooks: {
          ...baseManifest.hooks,
          onAgentStart: async () => {
            callOrder.push('manifest-start');
            return ok(undefined);
          },
          onAgentComplete: async () => {
            callOrder.push('manifest-complete');
            return ok(undefined);
          },
        },
      };

      const applyResult = applyObservers(
        [manifestWithHooks],
        manifestWithHooks.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifest = applyResult._unsafeUnwrap().manifests[0];

      const parts = createTextCompletionParts('Hello!');
      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(parts),
      );

      const generator = streamAgent(
        ctx,
        manifest,
        { type: 'request', prompt: 'Hello', manifestMap: new Map() },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      assertFinalResultOk(finalResult);

      // Verify order: observers called before manifest hooks
      expect(callOrder).toEqual([
        'observer-start',
        'manifest-start',
        'observer-complete',
        'manifest-complete',
      ]);
    });

    it('should call onAgentComplete when agent completes successfully', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      let completeCalled = false;
      let completeParams: unknown = null;

      const observer: AgentObserver = {
        createHooks: () =>
          ok({
            onAgentComplete: async (_ctx, params) => {
              completeCalled = true;
              completeParams = params;
              return ok(undefined);
            },
          }),
      };

      const baseManifest = createTestManifest('test-agent');
      const applyResult = applyObservers(
        [baseManifest],
        baseManifest.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifest = applyResult._unsafeUnwrap().manifests[0];

      const parts = createTextCompletionParts('Done!');
      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(parts),
      );

      const generator = streamAgent(
        ctx,
        manifest,
        { type: 'request', prompt: 'Complete', manifestMap: new Map() },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      assertFinalResultOk(finalResult);

      expect(completeCalled).toBe(true);
      expect(completeParams).toBeDefined();
    });

    it('should call onAgentError when agent errors', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      let errorCalled = false;
      let errorParams: unknown = null;

      const observer: AgentObserver = {
        createHooks: () =>
          ok({
            onAgentError: async (_ctx, params) => {
              errorCalled = true;
              errorParams = params;
              return ok(undefined);
            },
          }),
      };

      const baseManifest = createTestManifest('test-agent');
      const applyResult = applyObservers(
        [baseManifest],
        baseManifest.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifest = applyResult._unsafeUnwrap().manifests[0];

      // Mock error response
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
        { type: 'request', prompt: 'Fail', manifestMap: new Map() },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      const result = assertFinalResultOk(finalResult);
      expect(result.status).toBe('error');

      expect(errorCalled).toBe(true);
      expect(errorParams).toBeDefined();
    });
  });

  // ===========================================================================
  // Hook Error Handling Tests
  // ===========================================================================

  describe('Hook Error Handling', () => {
    it('should abort run when onAgentStart returns error', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      const observer: AgentObserver = {
        createHooks: () =>
          ok({
            onAgentStart: async () => {
              return err(internalError('Hook failed intentionally'));
            },
          }),
      };

      const baseManifest = createTestManifest('test-agent');
      const applyResult = applyObservers(
        [baseManifest],
        baseManifest.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifest = applyResult._unsafeUnwrap().manifests[0];

      const parts = createTextCompletionParts('Hello!');
      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(parts),
      );

      const generator = streamAgent(
        ctx,
        manifest,
        { type: 'request', prompt: 'Hello', manifestMap: new Map() },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);

      // When onAgentStart hook fails, the run should fail
      expect(finalResult).toBeDefined();
      const result = finalResult!.result;
      // The result itself is an error (not ok with error status)
      expect(result.isErr()).toBe(true);
    });

    it('should stop chain when first observer returns error', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      const callOrder: string[] = [];

      const observer1: AgentObserver = {
        createHooks: () =>
          ok({
            onAgentStart: async () => {
              callOrder.push('observer1');
              return err(internalError('Observer 1 failed'));
            },
          }),
      };

      const observer2: AgentObserver = {
        createHooks: () =>
          ok({
            onAgentStart: async () => {
              callOrder.push('observer2');
              return ok(undefined);
            },
          }),
      };

      const baseManifest = createTestManifest('test-agent');
      const applyResult = applyObservers(
        [baseManifest],
        baseManifest.config.id,
        [observer1, observer2],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifest = applyResult._unsafeUnwrap().manifests[0];

      const parts = createTextCompletionParts('Hello!');
      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(parts),
      );

      const generator = streamAgent(
        ctx,
        manifest,
        { type: 'request', prompt: 'Hello', manifestMap: new Map() },
        deps,
      );

      await collectStreamItems(generator);

      // Only observer1 should be called, observer2 should not be reached
      expect(callOrder).toEqual(['observer1']);
    });
  });

  // ===========================================================================
  // Parent Context Tests
  // ===========================================================================

  describe('Parent Context', () => {
    it('should pass parentManifestId to sub-agent onAgentStart', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      let childStartParams: unknown = null;

      const observer: AgentObserver = {
        createHooks: (context) =>
          ok({
            onAgentStart: async (_ctx, params) => {
              if (context.manifestId === AgentId('child-agent')) {
                childStartParams = params;
              }
              return ok(undefined);
            },
          }),
      };

      const childManifest = createTestManifest('child-agent');
      const parentManifest = createTestManifest('parent-agent', {
        subAgents: [
          {
            manifestId: AgentId('child-agent'),
            manifestVersion: '1.0.0',
            name: 'invoke-child',
            description: 'Invoke child agent',
          },
        ],
      });

      const applyResult = applyObservers(
        [childManifest, parentManifest],
        parentManifest.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifests = applyResult._unsafeUnwrap().manifests;
      const appliedParent = manifests.find(
        (m) => m.config.id === AgentId('parent-agent'),
      )!;
      const appliedChild = manifests.find(
        (m) => m.config.id === AgentId('child-agent'),
      )!;

      const manifestMap = createManifestMap([appliedChild, appliedParent]);

      const toolCallParts = createToolCallCompletionParts(
        'invoke-child',
        'call-1',
        { prompt: 'Do task' },
      );
      const childParts = createTextCompletionParts('Child done!');
      const parentParts = createTextCompletionParts('Parent done!');

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletionSequence([
          toolCallParts,
          childParts,
          parentParts,
        ]),
      );

      const generator = streamAgent(
        ctx,
        appliedParent,
        { type: 'request', prompt: 'Start', manifestMap },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      assertFinalResultOk(finalResult);

      // Verify child received parent context
      expect(childStartParams).toBeDefined();
      const params = childStartParams as {
        parentManifestId?: string;
        toolCallId?: string;
      };
      expect(params.parentManifestId).toBe(AgentId('parent-agent'));
      expect(params.toolCallId).toBeDefined();
    });

    it('should have undefined parentManifestId for root agent', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      let rootStartParams: unknown = null;

      const observer: AgentObserver = {
        createHooks: (context) =>
          ok({
            onAgentStart: async (_ctx, params) => {
              if (context.isRoot) {
                rootStartParams = params;
              }
              return ok(undefined);
            },
          }),
      };

      const baseManifest = createTestManifest('root-agent');
      const applyResult = applyObservers(
        [baseManifest],
        baseManifest.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifest = applyResult._unsafeUnwrap().manifests[0];

      const parts = createTextCompletionParts('Done!');
      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(parts),
      );

      const generator = streamAgent(
        ctx,
        manifest,
        { type: 'request', prompt: 'Hello', manifestMap: new Map() },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      assertFinalResultOk(finalResult);

      expect(rootStartParams).toBeDefined();
      const params = rootStartParams as { parentManifestId?: string };
      expect(params.parentManifestId).toBeUndefined();
    });

    it('should pass parent context to onAgentComplete for sub-agent', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      let childCompleteParams: unknown = null;

      const observer: AgentObserver = {
        createHooks: (context) =>
          ok({
            onAgentComplete: async (_ctx, params) => {
              if (context.manifestId === AgentId('child-agent')) {
                childCompleteParams = params;
              }
              return ok(undefined);
            },
          }),
      };

      const childManifest = createTestManifest('child-agent');
      const parentManifest = createTestManifest('parent-agent', {
        subAgents: [
          {
            manifestId: AgentId('child-agent'),
            manifestVersion: '1.0.0',
            name: 'invoke-child',
            description: 'Invoke child',
          },
        ],
      });

      const applyResult = applyObservers(
        [childManifest, parentManifest],
        parentManifest.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifests = applyResult._unsafeUnwrap().manifests;
      const appliedParent = manifests.find(
        (m) => m.config.id === AgentId('parent-agent'),
      )!;
      const appliedChild = manifests.find(
        (m) => m.config.id === AgentId('child-agent'),
      )!;

      const manifestMap = createManifestMap([appliedChild, appliedParent]);

      const toolCallParts = createToolCallCompletionParts(
        'invoke-child',
        'call-1',
        { prompt: 'Task' },
      );
      const childParts = createTextCompletionParts('Child done!');
      const parentParts = createTextCompletionParts('Parent done!');

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletionSequence([
          toolCallParts,
          childParts,
          parentParts,
        ]),
      );

      const generator = streamAgent(
        ctx,
        appliedParent,
        { type: 'request', prompt: 'Go', manifestMap },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      assertFinalResultOk(finalResult);

      expect(childCompleteParams).toBeDefined();
      const params = childCompleteParams as { parentManifestId?: string };
      expect(params.parentManifestId).toBe(AgentId('parent-agent'));
    });
  });

  // ===========================================================================
  // State Guarantee Tests
  // ===========================================================================

  describe('State Guarantees', () => {
    it('should have state in cache when onAgentStart fires', async () => {
      const ctx = createMockContext();
      const { deps, stateCache } = setup();

      let stateIdFromHook: AgentRunId | undefined;
      let stateExistedInHook = false;

      const observer: AgentObserver = {
        createHooks: () =>
          ok({
            onAgentStart: async (hookCtx, params) => {
              stateIdFromHook = params.stateId;
              // Check if state exists in cache
              const stateResult = await stateCache.get(hookCtx, params.stateId);
              stateExistedInHook = stateResult.isOk();
              return ok(undefined);
            },
          }),
      };

      const baseManifest = createTestManifest('test-agent');
      const applyResult = applyObservers(
        [baseManifest],
        baseManifest.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifest = applyResult._unsafeUnwrap().manifests[0];

      const parts = createTextCompletionParts('Hello!');
      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(parts),
      );

      const generator = streamAgent(
        ctx,
        manifest,
        { type: 'request', prompt: 'Hello', manifestMap: new Map() },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      assertFinalResultOk(finalResult);

      expect(stateIdFromHook).toBeDefined();
      expect(stateExistedInHook).toBe(true);
    });

    it('should have state with running status when onAgentStart fires', async () => {
      const ctx = createMockContext();
      const { deps, stateCache } = setup();

      let stateStatus: string | undefined;

      const observer: AgentObserver = {
        createHooks: () =>
          ok({
            onAgentStart: async (hookCtx, params) => {
              const stateResult = await stateCache.get(hookCtx, params.stateId);
              if (stateResult.isOk()) {
                stateStatus = stateResult.value.status;
              }
              return ok(undefined);
            },
          }),
      };

      const baseManifest = createTestManifest('test-agent');
      const applyResult = applyObservers(
        [baseManifest],
        baseManifest.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifest = applyResult._unsafeUnwrap().manifests[0];

      const parts = createTextCompletionParts('Hello!');
      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(parts),
      );

      const generator = streamAgent(
        ctx,
        manifest,
        { type: 'request', prompt: 'Hello', manifestMap: new Map() },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      assertFinalResultOk(finalResult);

      expect(stateStatus).toBe('running');
    });

    it('should have child state in cache when sub-agent onAgentStart fires', async () => {
      const ctx = createMockContext();
      const { deps, stateCache } = setup();

      let childStateExisted = false;

      const observer: AgentObserver = {
        createHooks: (context) =>
          ok({
            onAgentStart: async (hookCtx, params) => {
              if (context.manifestId === AgentId('child-agent')) {
                const stateResult = await stateCache.get(
                  hookCtx,
                  params.stateId,
                );
                childStateExisted = stateResult.isOk();
              }
              return ok(undefined);
            },
          }),
      };

      const childManifest = createTestManifest('child-agent');
      const parentManifest = createTestManifest('parent-agent', {
        subAgents: [
          {
            manifestId: AgentId('child-agent'),
            manifestVersion: '1.0.0',
            name: 'invoke-child',
            description: 'Invoke child',
          },
        ],
      });

      const applyResult = applyObservers(
        [childManifest, parentManifest],
        parentManifest.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifests = applyResult._unsafeUnwrap().manifests;
      const appliedParent = manifests.find(
        (m) => m.config.id === AgentId('parent-agent'),
      )!;
      const appliedChild = manifests.find(
        (m) => m.config.id === AgentId('child-agent'),
      )!;

      const manifestMap = createManifestMap([appliedChild, appliedParent]);

      const toolCallParts = createToolCallCompletionParts(
        'invoke-child',
        'call-1',
        { prompt: 'Task' },
      );
      const childParts = createTextCompletionParts('Child done!');
      const parentParts = createTextCompletionParts('Parent done!');

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletionSequence([
          toolCallParts,
          childParts,
          parentParts,
        ]),
      );

      const generator = streamAgent(
        ctx,
        appliedParent,
        { type: 'request', prompt: 'Start', manifestMap },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      assertFinalResultOk(finalResult);

      expect(childStateExisted).toBe(true);
    });
  });

  // ===========================================================================
  // Sub-Agent Hook Tests
  // ===========================================================================

  describe('Sub-Agent Hooks', () => {
    it('should call onSubAgentComplete when child completes', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      let subAgentCompleteCalled = false;
      let subAgentCompleteParams: unknown = null;

      const observer: AgentObserver = {
        createHooks: (context) =>
          ok({
            onSubAgentComplete: async (_ctx, params) => {
              if (context.manifestId === AgentId('parent-agent')) {
                subAgentCompleteCalled = true;
                subAgentCompleteParams = params;
              }
              return ok(undefined);
            },
          }),
      };

      const childManifest = createTestManifest('child-agent');
      const parentManifest = createTestManifest('parent-agent', {
        subAgents: [
          {
            manifestId: AgentId('child-agent'),
            manifestVersion: '1.0.0',
            name: 'invoke-child',
            description: 'Invoke child',
          },
        ],
      });

      const applyResult = applyObservers(
        [childManifest, parentManifest],
        parentManifest.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifests = applyResult._unsafeUnwrap().manifests;
      const appliedParent = manifests.find(
        (m) => m.config.id === AgentId('parent-agent'),
      )!;
      const appliedChild = manifests.find(
        (m) => m.config.id === AgentId('child-agent'),
      )!;

      const manifestMap = createManifestMap([appliedChild, appliedParent]);

      const toolCallParts = createToolCallCompletionParts(
        'invoke-child',
        'call-1',
        { prompt: 'Task' },
      );
      const childParts = createTextCompletionParts('Child done!');
      const parentParts = createTextCompletionParts('Parent done!');

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletionSequence([
          toolCallParts,
          childParts,
          parentParts,
        ]),
      );

      const generator = streamAgent(
        ctx,
        appliedParent,
        { type: 'request', prompt: 'Go', manifestMap },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      assertFinalResultOk(finalResult);

      expect(subAgentCompleteCalled).toBe(true);
      expect(subAgentCompleteParams).toBeDefined();
    });

    it('should pass correct params to onSubAgentComplete', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      interface CapturedParams {
        parentManifestId?: string;
        parentManifestVersion?: string;
        parentStateId?: string;
        childManifestId?: string;
        childManifestVersion?: string;
        childStateId?: string;
        toolCallId?: string;
        result?: unknown;
      }
      let capturedParams: CapturedParams | undefined;

      const observer: AgentObserver = {
        createHooks: (context) =>
          ok({
            onSubAgentComplete: async (_ctx, params) => {
              if (context.manifestId === AgentId('parent-agent')) {
                capturedParams = {
                  parentManifestId: params.parentManifestId,
                  parentManifestVersion: params.parentManifestVersion,
                  parentStateId: params.parentStateId,
                  childManifestId: params.childManifestId,
                  childManifestVersion: params.childManifestVersion,
                  childStateId: params.childStateId,
                  toolCallId: params.toolCallId,
                  result: params.result,
                };
              }
              return ok(undefined);
            },
          }),
      };

      const childManifest = createTestManifest('child-agent', {
        version: '2.0.0',
      });
      const parentManifest = createTestManifest('parent-agent', {
        version: '1.5.0',
        subAgents: [
          {
            manifestId: AgentId('child-agent'),
            manifestVersion: '2.0.0',
            name: 'invoke-child',
            description: 'Invoke child',
          },
        ],
      });

      const applyResult = applyObservers(
        [childManifest, parentManifest],
        parentManifest.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifests = applyResult._unsafeUnwrap().manifests;
      const appliedParent = manifests.find(
        (m) => m.config.id === AgentId('parent-agent'),
      )!;
      const appliedChild = manifests.find(
        (m) => m.config.id === AgentId('child-agent'),
      )!;

      const manifestMap = createManifestMap([appliedChild, appliedParent]);

      const toolCallParts = createToolCallCompletionParts(
        'invoke-child',
        'tool-call-123',
        { prompt: 'Do the task' },
      );
      const childParts = createTextCompletionParts('Child completed!');
      const parentParts = createTextCompletionParts('Parent done!');

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletionSequence([
          toolCallParts,
          childParts,
          parentParts,
        ]),
      );

      const generator = streamAgent(
        ctx,
        appliedParent,
        { type: 'request', prompt: 'Start', manifestMap },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      assertFinalResultOk(finalResult);

      expect(capturedParams).toBeDefined();
      expect(capturedParams!.parentManifestId).toBe(AgentId('parent-agent'));
      expect(capturedParams!.parentManifestVersion).toBe('1.5.0');
      expect(capturedParams!.parentStateId).toBeDefined();
      expect(capturedParams!.childManifestId).toBe(AgentId('child-agent'));
      expect(capturedParams!.childManifestVersion).toBe('2.0.0');
      expect(capturedParams!.childStateId).toBeDefined();
      expect(capturedParams!.toolCallId).toBe('tool-call-123');
      expect(capturedParams!.result).toBeDefined();
      // Result should have the expected structure
      const result = capturedParams!.result as {
        status?: string;
        manifestId?: string;
      };
      expect(result?.status).toBe('complete');
      expect(result?.manifestId).toBe(AgentId('child-agent'));
    });

    it('should call onSubAgentError when child errors', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      let subAgentErrorCalled = false;
      interface ErrorParams {
        childManifestId?: string;
        error?: { code: string; message: string };
      }
      let errorParams: ErrorParams | undefined;

      const observer: AgentObserver = {
        createHooks: (context) =>
          ok({
            onSubAgentError: async (_ctx, params) => {
              if (context.manifestId === AgentId('parent-agent')) {
                subAgentErrorCalled = true;
                errorParams = {
                  childManifestId: params.childManifestId,
                  error: params.error,
                };
              }
              return ok(undefined);
            },
          }),
      };

      const childManifest = createTestManifest('child-agent');
      const parentManifest = createTestManifest('parent-agent', {
        subAgents: [
          {
            manifestId: AgentId('child-agent'),
            manifestVersion: '1.0.0',
            name: 'invoke-child',
            description: 'Invoke child',
          },
        ],
      });

      const applyResult = applyObservers(
        [childManifest, parentManifest],
        parentManifest.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifests = applyResult._unsafeUnwrap().manifests;
      const appliedParent = manifests.find(
        (m) => m.config.id === AgentId('parent-agent'),
      )!;
      const appliedChild = manifests.find(
        (m) => m.config.id === AgentId('child-agent'),
      )!;

      const manifestMap = createManifestMap([appliedChild, appliedParent]);

      const toolCallParts = createToolCallCompletionParts(
        'invoke-child',
        'call-1',
        { prompt: 'Task' },
      );

      // Child returns an error
      const childErrorParts: StreamPart[] = [
        { type: 'start' },
        {
          type: 'start-step',
          request: { body: undefined },
          warnings: [],
        },
      ];

      let callCount = 0;
      deps.completionsGateway.streamCompletion.mockImplementation(
        async function* (): AsyncGenerator<Result<StreamPart, AppError>> {
          callCount++;
          if (callCount === 1) {
            // Parent's first call - tool call
            for (const part of toolCallParts) {
              yield ok(part);
            }
          } else if (callCount === 2) {
            // Child's call - error
            for (const part of childErrorParts) {
              yield ok(part);
            }
            yield err(internalError('Child agent failed'));
          }
        },
      );

      const generator = streamAgent(
        ctx,
        appliedParent,
        { type: 'request', prompt: 'Go', manifestMap },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      // Parent should still complete (with error result from child tool)
      expect(finalResult).toBeDefined();

      expect(subAgentErrorCalled).toBe(true);
      expect(errorParams).toBeDefined();
      expect(errorParams!.childManifestId).toBe(AgentId('child-agent'));
      expect(errorParams!.error?.code).toBe('InternalServer');
      expect(errorParams!.error?.message).toBe('Child agent failed');
    });

    it('should call multiple observers for sub-agent hooks', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      const callOrder: string[] = [];

      const observer1: AgentObserver = {
        createHooks: (context) =>
          ok({
            onSubAgentComplete: async () => {
              if (context.manifestId === AgentId('parent-agent')) {
                callOrder.push('observer1-complete');
              }
              return ok(undefined);
            },
          }),
      };

      const observer2: AgentObserver = {
        createHooks: (context) =>
          ok({
            onSubAgentComplete: async () => {
              if (context.manifestId === AgentId('parent-agent')) {
                callOrder.push('observer2-complete');
              }
              return ok(undefined);
            },
          }),
      };

      const childManifest = createTestManifest('child-agent');
      const parentManifest = createTestManifest('parent-agent', {
        subAgents: [
          {
            manifestId: AgentId('child-agent'),
            manifestVersion: '1.0.0',
            name: 'invoke-child',
            description: 'Invoke child',
          },
        ],
      });

      const applyResult = applyObservers(
        [childManifest, parentManifest],
        parentManifest.config.id,
        [observer1, observer2],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifests = applyResult._unsafeUnwrap().manifests;
      const appliedParent = manifests.find(
        (m) => m.config.id === AgentId('parent-agent'),
      )!;
      const appliedChild = manifests.find(
        (m) => m.config.id === AgentId('child-agent'),
      )!;

      const manifestMap = createManifestMap([appliedChild, appliedParent]);

      const toolCallParts = createToolCallCompletionParts(
        'invoke-child',
        'call-1',
        { prompt: 'Task' },
      );
      const childParts = createTextCompletionParts('Child done!');
      const parentParts = createTextCompletionParts('Parent done!');

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletionSequence([
          toolCallParts,
          childParts,
          parentParts,
        ]),
      );

      const generator = streamAgent(
        ctx,
        appliedParent,
        { type: 'request', prompt: 'Go', manifestMap },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      assertFinalResultOk(finalResult);

      // Both observers should be called in order
      expect(callOrder).toEqual(['observer1-complete', 'observer2-complete']);
    });

    it('should pass correct parentContext through nested sub-agents', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      const startParams: Array<{
        manifestId: string;
        parentManifestId?: string;
        toolCallId?: string;
      }> = [];

      const observer: AgentObserver = {
        createHooks: (context) =>
          ok({
            onAgentStart: async (_ctx, params) => {
              startParams.push({
                manifestId: context.manifestId,
                parentManifestId: params.parentManifestId,
                toolCallId: params.toolCallId,
              });
              return ok(undefined);
            },
          }),
      };

      // Create grandchild -> child -> parent hierarchy
      const grandchildManifest = createTestManifest('grandchild-agent');
      const childManifest = createTestManifest('child-agent', {
        subAgents: [
          {
            manifestId: AgentId('grandchild-agent'),
            manifestVersion: '1.0.0',
            name: 'invoke-grandchild',
            description: 'Invoke grandchild',
          },
        ],
      });
      const parentManifest = createTestManifest('parent-agent', {
        subAgents: [
          {
            manifestId: AgentId('child-agent'),
            manifestVersion: '1.0.0',
            name: 'invoke-child',
            description: 'Invoke child',
          },
        ],
      });

      const applyResult = applyObservers(
        [grandchildManifest, childManifest, parentManifest],
        parentManifest.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifests = applyResult._unsafeUnwrap().manifests;
      const appliedParent = manifests.find(
        (m) => m.config.id === AgentId('parent-agent'),
      )!;
      const appliedChild = manifests.find(
        (m) => m.config.id === AgentId('child-agent'),
      )!;
      const appliedGrandchild = manifests.find(
        (m) => m.config.id === AgentId('grandchild-agent'),
      )!;

      const manifestMap = createManifestMap([
        appliedGrandchild,
        appliedChild,
        appliedParent,
      ]);

      // Parent calls child, child calls grandchild
      const parentToolCall = createToolCallCompletionParts(
        'invoke-child',
        'parent-call-1',
        { prompt: 'Start child' },
      );
      const childToolCall = createToolCallCompletionParts(
        'invoke-grandchild',
        'child-call-1',
        { prompt: 'Start grandchild' },
      );
      const grandchildComplete = createTextCompletionParts('Grandchild done!');
      const childComplete = createTextCompletionParts('Child done!');
      const parentComplete = createTextCompletionParts('Parent done!');

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletionSequence([
          parentToolCall,
          childToolCall,
          grandchildComplete,
          childComplete,
          parentComplete,
        ]),
      );

      const generator = streamAgent(
        ctx,
        appliedParent,
        { type: 'request', prompt: 'Go', manifestMap },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      assertFinalResultOk(finalResult);

      // Verify parent context chain
      expect(startParams.length).toBe(3);

      // Parent should have no parent context
      const parentStart = startParams.find(
        (p) => p.manifestId === AgentId('parent-agent'),
      );
      expect(parentStart?.parentManifestId).toBeUndefined();
      expect(parentStart?.toolCallId).toBeUndefined();

      // Child should have parent as parent
      const childStart = startParams.find(
        (p) => p.manifestId === AgentId('child-agent'),
      );
      expect(childStart?.parentManifestId).toBe(AgentId('parent-agent'));
      expect(childStart?.toolCallId).toBe('parent-call-1');

      // Grandchild should have child as parent
      const grandchildStart = startParams.find(
        (p) => p.manifestId === AgentId('grandchild-agent'),
      );
      expect(grandchildStart?.parentManifestId).toBe(AgentId('child-agent'));
      expect(grandchildStart?.toolCallId).toBe('child-call-1');
    });

    it('should call onSubAgentStart when sub-agent begins execution', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      let subAgentStartCalled = false;
      interface SubAgentStartParams {
        parentManifestId?: string;
        parentManifestVersion?: string;
        parentStateId?: string;
        childManifestId?: string;
        childManifestVersion?: string;
        childStateId?: string;
        toolCallId?: string;
      }
      let capturedParams: SubAgentStartParams | undefined;

      const observer: AgentObserver = {
        createHooks: (context) =>
          ok({
            onSubAgentStart: async (_ctx, params) => {
              if (context.manifestId === AgentId('parent-agent')) {
                subAgentStartCalled = true;
                capturedParams = {
                  parentManifestId: params.parentManifestId,
                  parentManifestVersion: params.parentManifestVersion,
                  parentStateId: params.parentStateId,
                  childManifestId: params.childManifestId,
                  childManifestVersion: params.childManifestVersion,
                  childStateId: params.childStateId,
                  toolCallId: params.toolCallId,
                };
              }
              return ok(undefined);
            },
          }),
      };

      const childManifest = createTestManifest('child-agent');
      const parentManifest = createTestManifest('parent-agent', {
        subAgents: [
          {
            manifestId: AgentId('child-agent'),
            manifestVersion: '1.0.0',
            name: 'invoke-child',
            description: 'Invoke child',
          },
        ],
      });

      const applyResult = applyObservers(
        [childManifest, parentManifest],
        parentManifest.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifests = applyResult._unsafeUnwrap().manifests;
      const appliedParent = manifests.find(
        (m) => m.config.id === AgentId('parent-agent'),
      )!;
      const appliedChild = manifests.find(
        (m) => m.config.id === AgentId('child-agent'),
      )!;

      const manifestMap = createManifestMap([appliedChild, appliedParent]);

      const toolCallParts = createToolCallCompletionParts(
        'invoke-child',
        'call-123',
        { prompt: 'Task' },
      );
      const childParts = createTextCompletionParts('Child done!');
      const parentParts = createTextCompletionParts('Parent done!');

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletionSequence([
          toolCallParts,
          childParts,
          parentParts,
        ]),
      );

      const generator = streamAgent(
        ctx,
        appliedParent,
        { type: 'request', prompt: 'Go', manifestMap },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      assertFinalResultOk(finalResult);

      expect(subAgentStartCalled).toBe(true);
      expect(capturedParams).toBeDefined();
      expect(capturedParams!.parentManifestId).toBe(AgentId('parent-agent'));
      expect(capturedParams!.childManifestId).toBe(AgentId('child-agent'));
      expect(capturedParams!.childStateId).toBeDefined();
      expect(capturedParams!.toolCallId).toBe('call-123');
    });

    it('should abort sub-agent when onSubAgentStart returns error', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      const observer: AgentObserver = {
        createHooks: (context) =>
          ok({
            onSubAgentStart: async () => {
              if (context.manifestId === AgentId('parent-agent')) {
                return err(internalError('Rejected sub-agent start'));
              }
              return ok(undefined);
            },
          }),
      };

      const childManifest = createTestManifest('child-agent');
      const parentManifest = createTestManifest('parent-agent', {
        subAgents: [
          {
            manifestId: AgentId('child-agent'),
            manifestVersion: '1.0.0',
            name: 'invoke-child',
            description: 'Invoke child',
          },
        ],
      });

      const applyResult = applyObservers(
        [childManifest, parentManifest],
        parentManifest.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifests = applyResult._unsafeUnwrap().manifests;
      const appliedParent = manifests.find(
        (m) => m.config.id === AgentId('parent-agent'),
      )!;
      const appliedChild = manifests.find(
        (m) => m.config.id === AgentId('child-agent'),
      )!;

      const manifestMap = createManifestMap([appliedChild, appliedParent]);

      const toolCallParts = createToolCallCompletionParts(
        'invoke-child',
        'call-1',
        { prompt: 'Task' },
      );
      const childParts = createTextCompletionParts('Child done!');
      const parentParts = createTextCompletionParts('Parent done!');

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletionSequence([
          toolCallParts,
          childParts,
          parentParts,
        ]),
      );

      const generator = streamAgent(
        ctx,
        appliedParent,
        { type: 'request', prompt: 'Go', manifestMap },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      // Run should complete, but sub-agent tool should have returned error
      expect(finalResult).toBeDefined();
      // The parent continues execution even if sub-agent tool fails
      // because tool errors are converted to tool results
    });

    it('should call onSubAgentStart before onSubAgentComplete', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      const callOrder: string[] = [];

      const observer: AgentObserver = {
        createHooks: (context) =>
          ok({
            onSubAgentStart: async () => {
              if (context.manifestId === AgentId('parent-agent')) {
                callOrder.push('start');
              }
              return ok(undefined);
            },
            onSubAgentComplete: async () => {
              if (context.manifestId === AgentId('parent-agent')) {
                callOrder.push('complete');
              }
              return ok(undefined);
            },
          }),
      };

      const childManifest = createTestManifest('child-agent');
      const parentManifest = createTestManifest('parent-agent', {
        subAgents: [
          {
            manifestId: AgentId('child-agent'),
            manifestVersion: '1.0.0',
            name: 'invoke-child',
            description: 'Invoke child',
          },
        ],
      });

      const applyResult = applyObservers(
        [childManifest, parentManifest],
        parentManifest.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifests = applyResult._unsafeUnwrap().manifests;
      const appliedParent = manifests.find(
        (m) => m.config.id === AgentId('parent-agent'),
      )!;
      const appliedChild = manifests.find(
        (m) => m.config.id === AgentId('child-agent'),
      )!;

      const manifestMap = createManifestMap([appliedChild, appliedParent]);

      const toolCallParts = createToolCallCompletionParts(
        'invoke-child',
        'call-1',
        { prompt: 'Task' },
      );
      const childParts = createTextCompletionParts('Child done!');
      const parentParts = createTextCompletionParts('Parent done!');

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletionSequence([
          toolCallParts,
          childParts,
          parentParts,
        ]),
      );

      const generator = streamAgent(
        ctx,
        appliedParent,
        { type: 'request', prompt: 'Go', manifestMap },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      assertFinalResultOk(finalResult);

      // Verify order: start before complete
      expect(callOrder).toEqual(['start', 'complete']);
    });
  });

  // ===========================================================================
  // Observer Creation Tests
  // ===========================================================================

  describe('Observer Creation', () => {
    it('should fail applyObservers when observer createHooks returns error', () => {
      const failingObserver: AgentObserver = {
        createHooks: () => err(internalError('Observer init failed')),
      };

      const manifest = createTestManifest('test-agent');
      const result = applyObservers([manifest], manifest.config.id, [
        failingObserver,
      ]);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toBe('Observer init failed');
    });

    it('should not call createHooks on remaining observers after one fails', () => {
      let observer2Called = false;

      const failingObserver: AgentObserver = {
        createHooks: () => err(internalError('First observer failed')),
      };

      const observer2: AgentObserver = {
        createHooks: () => {
          observer2Called = true;
          return ok({});
        },
      };

      const manifest = createTestManifest('test-agent');
      const result = applyObservers([manifest], manifest.config.id, [
        failingObserver,
        observer2,
      ]);

      expect(result.isErr()).toBe(true);
      expect(observer2Called).toBe(false);
    });
  });

  // ===========================================================================
  // Agent Suspension Hook Tests
  // ===========================================================================

  describe('Agent Suspension Hooks', () => {
    it('should call onAgentSuspend when agent suspends for HITL', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      let suspendCalled = false;
      interface SuspendParams {
        manifestId?: string;
        stateId?: string;
        suspensions?: Array<{ type: string; approvalId: string }>;
      }
      let capturedParams: SuspendParams | undefined;

      const observer: AgentObserver = {
        createHooks: () =>
          ok({
            onAgentSuspend: async (_ctx, params) => {
              suspendCalled = true;
              capturedParams = {
                manifestId: params.manifestId,
                stateId: params.stateId,
                suspensions: params.suspensions.map((s) => ({
                  type: s.type,
                  approvalId: 'approvalId' in s ? s.approvalId : '',
                })),
              };
              return ok(undefined);
            },
          }),
      };

      // Create manifest with HITL tool requiring approval
      const baseManifest = createTestManifest('test-agent', {
        tools: [
          {
            type: 'function',
            function: {
              name: 'dangerous-tool',
              description: 'A tool that requires approval',
              parameters: { type: 'object', properties: {} },
            },
          },
        ],
        humanInTheLoop: {
          defaultRequiresApproval: false,
          alwaysRequireApproval: ['dangerous-tool'],
        },
      });

      const applyResult = applyObservers(
        [baseManifest],
        baseManifest.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifest = applyResult._unsafeUnwrap().manifests[0];

      // Mock tool-approval-request stream part
      const approvalParts: StreamPart[] = [
        { type: 'start' },
        {
          type: 'start-step',
          request: { body: undefined },
          warnings: [],
        },
        {
          type: 'tool-approval-request',
          approvalId: 'approval-123',
          toolCall: {
            toolCallId: 'call-1',
            toolName: 'dangerous-tool',
            input: {},
          },
        },
        {
          type: 'finish-step',
          response: {
            id: 'resp-1',
            timestamp: new Date(),
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

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(approvalParts),
      );

      const generator = streamAgent(
        ctx,
        manifest,
        {
          type: 'request',
          prompt: 'Do something dangerous',
          manifestMap: new Map(),
        },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      expect(finalResult).toBeDefined();
      const result = finalResult!.result;
      expect(result.isOk()).toBe(true);
      const runResult = result._unsafeUnwrap();
      expect(runResult.status).toBe('suspended');

      expect(suspendCalled).toBe(true);
      expect(capturedParams).toBeDefined();
      expect(capturedParams!.manifestId).toBe(AgentId('test-agent'));
      expect(capturedParams!.stateId).toBeDefined();
      expect(capturedParams!.suspensions).toHaveLength(1);
      expect(capturedParams!.suspensions![0].type).toBe('tool-approval');
      expect(capturedParams!.suspensions![0].approvalId).toBe('approval-123');
    });

    it('should pass multiple suspensions to onAgentSuspend', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      let capturedSuspensions: Array<{ approvalId: string }> = [];

      const observer: AgentObserver = {
        createHooks: () =>
          ok({
            onAgentSuspend: async (_ctx, params) => {
              capturedSuspensions = params.suspensions.map((s) => ({
                approvalId: 'approvalId' in s ? s.approvalId : '',
              }));
              return ok(undefined);
            },
          }),
      };

      const baseManifest = createTestManifest('test-agent', {
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
        humanInTheLoop: {
          defaultRequiresApproval: false,
          alwaysRequireApproval: ['tool-a', 'tool-b'],
        },
      });

      const applyResult = applyObservers(
        [baseManifest],
        baseManifest.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifest = applyResult._unsafeUnwrap().manifests[0];

      // Mock multiple tool-approval-requests
      const approvalParts: StreamPart[] = [
        { type: 'start' },
        {
          type: 'start-step',
          request: { body: undefined },
          warnings: [],
        },
        {
          type: 'tool-approval-request',
          approvalId: 'approval-1',
          toolCall: {
            toolCallId: 'call-1',
            toolName: 'tool-a',
            input: {},
          },
        },
        {
          type: 'tool-approval-request',
          approvalId: 'approval-2',
          toolCall: {
            toolCallId: 'call-2',
            toolName: 'tool-b',
            input: {},
          },
        },
        {
          type: 'finish-step',
          response: {
            id: 'resp-1',
            timestamp: new Date(),
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

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(approvalParts),
      );

      const generator = streamAgent(
        ctx,
        manifest,
        { type: 'request', prompt: 'Do tasks', manifestMap: new Map() },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      expect(finalResult).toBeDefined();
      const result = finalResult!.result;
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe('suspended');

      expect(capturedSuspensions).toHaveLength(2);
      expect(capturedSuspensions[0].approvalId).toBe('approval-1');
      expect(capturedSuspensions[1].approvalId).toBe('approval-2');
    });

    it('should call onAgentSuspend after state is finalized', async () => {
      const ctx = createMockContext();
      const { deps, stateCache } = setup();

      let stateStatus: string | undefined;
      let stateIdFromHook: AgentRunId | undefined;

      const observer: AgentObserver = {
        createHooks: () =>
          ok({
            onAgentSuspend: async (hookCtx, params) => {
              stateIdFromHook = params.stateId;
              const stateResult = await stateCache.get(hookCtx, params.stateId);
              if (stateResult.isOk()) {
                stateStatus = stateResult.value.status;
              }
              return ok(undefined);
            },
          }),
      };

      const baseManifest = createTestManifest('test-agent', {
        tools: [
          {
            type: 'function',
            function: {
              name: 'dangerous-tool',
              description: 'Requires approval',
              parameters: { type: 'object', properties: {} },
            },
          },
        ],
        humanInTheLoop: {
          defaultRequiresApproval: false,
          alwaysRequireApproval: ['dangerous-tool'],
        },
      });

      const applyResult = applyObservers(
        [baseManifest],
        baseManifest.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifest = applyResult._unsafeUnwrap().manifests[0];

      const approvalParts: StreamPart[] = [
        { type: 'start' },
        {
          type: 'start-step',
          request: { body: undefined },
          warnings: [],
        },
        {
          type: 'tool-approval-request',
          approvalId: 'approval-123',
          toolCall: {
            toolCallId: 'call-1',
            toolName: 'dangerous-tool',
            input: {},
          },
        },
        {
          type: 'finish-step',
          response: {
            id: 'resp-1',
            timestamp: new Date(),
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

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(approvalParts),
      );

      const generator = streamAgent(
        ctx,
        manifest,
        { type: 'request', prompt: 'Do something', manifestMap: new Map() },
        deps,
      );

      await collectStreamItems(generator);

      expect(stateIdFromHook).toBeDefined();
      // State should be suspended when hook fires
      expect(stateStatus).toBe('suspended');
    });
  });

  // ===========================================================================
  // Agent Resume Hook Tests
  // ===========================================================================

  describe('Agent Resume Hooks', () => {
    it('should call onAgentResume when resuming from suspension', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      let resumeCalled = false;
      let startCalled = false;
      interface ResumeParams {
        manifestId?: string;
        stateId?: string;
        resolvedSuspensions?: Array<{ type: string }>;
      }
      let capturedResumeParams: ResumeParams | undefined;

      const observer: AgentObserver = {
        createHooks: () =>
          ok({
            onAgentStart: async () => {
              startCalled = true;
              return ok(undefined);
            },
            onAgentResume: async (_ctx, params) => {
              resumeCalled = true;
              capturedResumeParams = {
                manifestId: params.manifestId,
                stateId: params.stateId,
                resolvedSuspensions: params.resolvedSuspensions.map((s) => ({
                  type: s.type,
                })),
              };
              return ok(undefined);
            },
          }),
      };

      const baseManifest = createTestManifest('test-agent', {
        tools: [
          {
            type: 'function',
            function: {
              name: 'dangerous-tool',
              description: 'Requires approval',
              parameters: { type: 'object', properties: {} },
            },
          },
        ],
        humanInTheLoop: {
          defaultRequiresApproval: false,
          alwaysRequireApproval: ['dangerous-tool'],
        },
        toolExecutors: {
          'dangerous-tool': async () => ({
            type: 'success',
            value: { executed: true },
          }),
        },
      });

      const applyResult = applyObservers(
        [baseManifest],
        baseManifest.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifest = applyResult._unsafeUnwrap().manifests[0];

      // Step 1: Get agent to suspend
      const approvalParts: StreamPart[] = [
        { type: 'start' },
        {
          type: 'start-step',
          request: { body: undefined },
          warnings: [],
        },
        {
          type: 'tool-approval-request',
          approvalId: 'approval-123',
          toolCall: {
            toolCallId: 'call-1',
            toolName: 'dangerous-tool',
            input: {},
          },
        },
        {
          type: 'finish-step',
          response: {
            id: 'resp-1',
            timestamp: new Date(),
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

      const completionParts = createTextCompletionParts('Done!');

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletionSequence([approvalParts, completionParts]),
      );

      const generator1 = streamAgent(
        ctx,
        manifest,
        { type: 'request', prompt: 'Do something', manifestMap: new Map() },
        deps,
      );

      const { finalResult: suspendResult } =
        await collectStreamItems(generator1);
      expect(suspendResult).toBeDefined();
      expect(suspendResult!.result.isOk()).toBe(true);
      const suspended = suspendResult!.result._unsafeUnwrap();
      expect(suspended.status).toBe('suspended');

      // Reset tracking
      startCalled = false;
      resumeCalled = false;

      // Step 2: Resume with approval
      const runId = suspended.runId;
      const generator2 = streamAgent(
        ctx,
        manifest,
        {
          type: 'approval',
          runId,
          response: {
            type: 'approval',
            approvalId: 'approval-123',
            approved: true,
          },
          manifestMap: new Map(),
        },
        deps,
      );

      const { finalResult: resumeResult } =
        await collectStreamItems(generator2);
      expect(resumeResult).toBeDefined();
      expect(resumeResult!.result.isOk()).toBe(true);

      // Verify onAgentResume was called (not onAgentStart)
      expect(resumeCalled).toBe(true);
      expect(startCalled).toBe(false);
      expect(capturedResumeParams).toBeDefined();
      expect(capturedResumeParams!.manifestId).toBe(AgentId('test-agent'));
      expect(capturedResumeParams!.stateId).toBe(runId);
      expect(capturedResumeParams!.resolvedSuspensions).toHaveLength(1);
      expect(capturedResumeParams!.resolvedSuspensions![0].type).toBe(
        'tool-approval',
      );
    });

    it('should abort run when onAgentResume returns error', async () => {
      const ctx = createMockContext();
      const { deps } = setup();

      const observer: AgentObserver = {
        createHooks: () =>
          ok({
            onAgentResume: async () => {
              return err(internalError('Resume rejected'));
            },
          }),
      };

      const baseManifest = createTestManifest('test-agent', {
        tools: [
          {
            type: 'function',
            function: {
              name: 'dangerous-tool',
              description: 'Requires approval',
              parameters: { type: 'object', properties: {} },
            },
          },
        ],
        humanInTheLoop: {
          defaultRequiresApproval: false,
          alwaysRequireApproval: ['dangerous-tool'],
        },
        toolExecutors: {
          'dangerous-tool': async () => ({
            type: 'success',
            value: { executed: true },
          }),
        },
      });

      const applyResult = applyObservers(
        [baseManifest],
        baseManifest.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifest = applyResult._unsafeUnwrap().manifests[0];

      // Step 1: Get agent to suspend
      const approvalParts: StreamPart[] = [
        { type: 'start' },
        {
          type: 'start-step',
          request: { body: undefined },
          warnings: [],
        },
        {
          type: 'tool-approval-request',
          approvalId: 'approval-123',
          toolCall: {
            toolCallId: 'call-1',
            toolName: 'dangerous-tool',
            input: {},
          },
        },
        {
          type: 'finish-step',
          response: {
            id: 'resp-1',
            timestamp: new Date(),
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

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(approvalParts),
      );

      const generator1 = streamAgent(
        ctx,
        manifest,
        { type: 'request', prompt: 'Do something', manifestMap: new Map() },
        deps,
      );

      const { finalResult: suspendResult } =
        await collectStreamItems(generator1);
      expect(suspendResult!.result.isOk()).toBe(true);
      const suspended = suspendResult!.result._unsafeUnwrap();
      expect(suspended.status).toBe('suspended');

      // Step 2: Try to resume - should fail due to hook error
      const runId = suspended.runId;
      const completionParts = createTextCompletionParts('Done!');
      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(completionParts),
      );

      const generator2 = streamAgent(
        ctx,
        manifest,
        {
          type: 'approval',
          runId,
          response: {
            type: 'approval',
            approvalId: 'approval-123',
            approved: true,
          },
          manifestMap: new Map(),
        },
        deps,
      );

      const { finalResult: resumeResult } =
        await collectStreamItems(generator2);
      expect(resumeResult).toBeDefined();
      // Resume should fail with error
      expect(resumeResult!.result.isErr()).toBe(true);
    });

    it('should have state with running status when onAgentResume fires', async () => {
      const ctx = createMockContext();
      const { deps, stateCache } = setup();

      let stateStatus: string | undefined;

      const observer: AgentObserver = {
        createHooks: () =>
          ok({
            onAgentResume: async (hookCtx, params) => {
              const stateResult = await stateCache.get(hookCtx, params.stateId);
              if (stateResult.isOk()) {
                stateStatus = stateResult.value.status;
              }
              return ok(undefined);
            },
          }),
      };

      const baseManifest = createTestManifest('test-agent', {
        tools: [
          {
            type: 'function',
            function: {
              name: 'dangerous-tool',
              description: 'Requires approval',
              parameters: { type: 'object', properties: {} },
            },
          },
        ],
        humanInTheLoop: {
          defaultRequiresApproval: false,
          alwaysRequireApproval: ['dangerous-tool'],
        },
        toolExecutors: {
          'dangerous-tool': async () => ({
            type: 'success',
            value: { executed: true },
          }),
        },
      });

      const applyResult = applyObservers(
        [baseManifest],
        baseManifest.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifest = applyResult._unsafeUnwrap().manifests[0];

      // Step 1: Suspend
      const approvalParts: StreamPart[] = [
        { type: 'start' },
        {
          type: 'start-step',
          request: { body: undefined },
          warnings: [],
        },
        {
          type: 'tool-approval-request',
          approvalId: 'approval-123',
          toolCall: {
            toolCallId: 'call-1',
            toolName: 'dangerous-tool',
            input: {},
          },
        },
        {
          type: 'finish-step',
          response: {
            id: 'resp-1',
            timestamp: new Date(),
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

      const completionParts = createTextCompletionParts('Done!');

      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletionSequence([approvalParts, completionParts]),
      );

      const generator1 = streamAgent(
        ctx,
        manifest,
        { type: 'request', prompt: 'Do something', manifestMap: new Map() },
        deps,
      );

      const { finalResult: suspendResult } =
        await collectStreamItems(generator1);
      const suspended = suspendResult!.result._unsafeUnwrap();

      // Step 2: Resume
      const generator2 = streamAgent(
        ctx,
        manifest,
        {
          type: 'approval',
          runId: suspended.runId,
          response: {
            type: 'approval',
            approvalId: 'approval-123',
            approved: true,
          },
          manifestMap: new Map(),
        },
        deps,
      );

      await collectStreamItems(generator2);

      // State should be running when onAgentResume fires
      expect(stateStatus).toBe('running');
    });
  });

  // ===========================================================================
  // Agent Cancellation Hook Tests
  // ===========================================================================

  describe('Agent Cancellation Hooks', () => {
    it('should call onAgentCancelled when agent is cancelled', async () => {
      const { deps } = setup();

      let cancelledCalled = false;
      interface CancelledParams {
        manifestId?: string;
        stateId?: string;
        reason?: string;
      }
      let capturedParams: CancelledParams | undefined;

      const observer: AgentObserver = {
        createHooks: () =>
          ok({
            onAgentCancelled: async (_ctx, params) => {
              cancelledCalled = true;
              capturedParams = {
                manifestId: params.manifestId,
                stateId: params.stateId,
                reason: params.reason,
              };
              return ok(undefined);
            },
          }),
      };

      const baseManifest = createTestManifest('test-agent');
      const applyResult = applyObservers(
        [baseManifest],
        baseManifest.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifest = applyResult._unsafeUnwrap().manifests[0];

      // Create an AbortController to cancel the request
      const abortController = new AbortController();
      const ctx = createMockContext({ signal: abortController.signal });

      // Create a slow completion that gives us time to abort
      let partIndex = 0;
      const parts = createTextCompletionParts('Hello!');
      deps.completionsGateway.streamCompletion.mockImplementation(
        async function* (): AsyncGenerator<Result<StreamPart, AppError>> {
          for (const part of parts) {
            partIndex++;
            // Abort after start-step
            if (partIndex === 2) {
              abortController.abort();
            }
            yield ok(part);
          }
        },
      );

      const generator = streamAgent(
        ctx,
        manifest,
        { type: 'request', prompt: 'Hello', manifestMap: new Map() },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      expect(finalResult).toBeDefined();
      const result = finalResult!.result;
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe('cancelled');

      expect(cancelledCalled).toBe(true);
      expect(capturedParams).toBeDefined();
      expect(capturedParams!.manifestId).toBe(AgentId('test-agent'));
      expect(capturedParams!.stateId).toBeDefined();
      expect(capturedParams!.reason).toBe('User cancelled');
    });

    it('should call multiple observers for onAgentCancelled', async () => {
      const { deps } = setup();

      const callOrder: string[] = [];

      const observer1: AgentObserver = {
        createHooks: () =>
          ok({
            onAgentCancelled: async () => {
              callOrder.push('observer1');
              return ok(undefined);
            },
          }),
      };

      const observer2: AgentObserver = {
        createHooks: () =>
          ok({
            onAgentCancelled: async () => {
              callOrder.push('observer2');
              return ok(undefined);
            },
          }),
      };

      const baseManifest = createTestManifest('test-agent');
      const applyResult = applyObservers(
        [baseManifest],
        baseManifest.config.id,
        [observer1, observer2],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifest = applyResult._unsafeUnwrap().manifests[0];

      const abortController = new AbortController();
      const ctx = createMockContext({ signal: abortController.signal });

      let partIndex = 0;
      const parts = createTextCompletionParts('Hello!');
      deps.completionsGateway.streamCompletion.mockImplementation(
        async function* (): AsyncGenerator<Result<StreamPart, AppError>> {
          for (const part of parts) {
            partIndex++;
            if (partIndex === 2) {
              abortController.abort();
            }
            yield ok(part);
          }
        },
      );

      const generator = streamAgent(
        ctx,
        manifest,
        { type: 'request', prompt: 'Hello', manifestMap: new Map() },
        deps,
      );

      const { finalResult } = await collectStreamItems(generator);
      expect(finalResult!.result.isOk()).toBe(true);
      expect(finalResult!.result._unsafeUnwrap().status).toBe('cancelled');

      // Both observers should be called in order
      expect(callOrder).toEqual(['observer1', 'observer2']);
    });
  });
});
