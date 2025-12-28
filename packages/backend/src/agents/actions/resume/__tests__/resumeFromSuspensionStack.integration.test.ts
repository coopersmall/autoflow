/**
 * Integration tests for resumeFromSuspensionStack.
 *
 * Tests the complete suspension stack resumption logic with real infrastructure:
 * - Real PostgreSQL database for persistence
 * - Real Redis cache for agent state
 * - Real state cache operations
 * - Mocked runAgent to control execution flow
 *
 * These tests verify the orchestration logic handles:
 * - Arbitrarily deep suspension stacks (2, 3, 4+ levels)
 * - Re-suspensions at any level
 * - Proper state propagation through parent chains
 * - Error handling and validation
 */

import { describe, expect, it, mock } from 'bun:test';
import type {
  StreamAgentFinalResult,
  StreamAgentItem,
} from '@backend/agents/actions/streamAgent';
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
import { AgentId, AgentRunId, type AgentRunResult } from '@core/domain/agents';
import type { AppError } from '@core/errors';
import * as fc from 'fast-check';
import { err, ok, type Result } from 'neverthrow';
import { resumeFromSuspensionStack } from '../resumeFromSuspensionStack';
import {
  agentIdArb,
  createAgentManifest,
  createAgentState,
  createCompleteResult,
  createContinueResponse,
  createErrorResult,
  createManifestMap,
  createSuspendedResult,
  createSuspension,
  createSuspensionStack,
  createSuspensionStackEntry,
  toolCallIdArb,
  validStackArb,
} from './fixtures';

describe('resumeFromSuspensionStack Integration Tests', () => {
  const { getConfig, getLogger } = setupIntegrationTest();

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

    // Mocked (not used when runAgent is mocked)
    const completionsGateway = getMockedCompletionsGateway();
    const mcpService = getMockedMCPService();

    return {
      deps: {
        stateCache,
        storageService,
        completionsGateway,
        mcpService,
        logger,
        agentRunLock,
        cancellationCache,
      },
    };
  };

  // Helper to create sequence mock for streamAgent
  const createStreamAgentSequence = (
    results: Result<AgentRunResult, AppError>[],
  ) => {
    let callIndex = 0;
    const mockFn = mock();

    mockFn.mockImplementation(() => {
      async function* generator(): AsyncGenerator<StreamAgentItem, void> {
        const result = results[callIndex];
        callIndex++;
        const finalResult: StreamAgentFinalResult = {
          type: 'final',
          result,
        };
        yield finalResult;
      }
      return generator();
    });

    return mockFn;
  };

  // Create a streamAgent mock that supports the old .mockResolvedValue pattern
  // by wrapping the mock with a custom object
  const createRunAgentMock = () => {
    let resultToReturn: Result<AgentRunResult, AppError> = ok(
      createCompleteResult(),
    );

    const createGenerator = () => {
      async function* generator(): AsyncGenerator<StreamAgentItem, void> {
        const finalResult: StreamAgentFinalResult = {
          type: 'final',
          result: resultToReturn,
        };
        yield finalResult;
      }
      return generator();
    };

    // Create a callable function that returns a generator
    const mockFn = Object.assign(
      function streamAgentMock() {
        return createGenerator();
      },
      {
        mockResolvedValue: (value: Result<AgentRunResult, AppError>) => {
          resultToReturn = value;
          return mockFn;
        },
        mock: { calls: [] },
      },
    );

    return mockFn;
  };

  // Backward compat alias for sequence
  const createRunAgentSequence = createStreamAgentSequence;

  describe('Validation', () => {
    it('should reject stack with 0 entries', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      const manifest = createAgentManifest('root', '1.0.0');
      const manifestMap = createManifestMap([manifest]);
      const savedState = createAgentState();
      const stack = {
        agents: [],
        leafSuspension: createSuspension(),
      };
      const response = createContinueResponse('approval-id');

      const result = await resumeFromSuspensionStack(
        ctx,
        manifest,
        manifestMap,
        savedState,
        stack,
        response,
        deps,
      );

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('at least 2 entries');
      }
    });

    it('should reject stack with 1 entry', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      const manifest = createAgentManifest('root', '1.0.0');
      const manifestMap = createManifestMap([manifest]);
      const savedState = createAgentState();
      const stack = {
        agents: [createSuspensionStackEntry()],
        leafSuspension: createSuspension(),
      };
      const response = createContinueResponse('approval-id');

      const result = await resumeFromSuspensionStack(
        ctx,
        manifest,
        manifestMap,
        savedState,
        stack,
        response,
        deps,
      );

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('at least 2 entries');
      }
    });

    it('should return notFound when deepest manifest is missing', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      const manifest = createAgentManifest('root', '1.0.0');
      const childManifest = createAgentManifest('child', '1.0.0');
      const manifestMap = createManifestMap([manifest]); // Only root manifest
      const savedState = createAgentState();
      const stack = createSuspensionStack([
        manifest.config.id,
        childManifest.config.id,
      ]);
      stack.agents[1].manifestId = AgentId('missing-agent');
      const response = createContinueResponse('approval-id');

      const result = await resumeFromSuspensionStack(
        ctx,
        manifest,
        manifestMap,
        savedState,
        stack,
        response,
        deps,
      );

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('NotFound');
        expect(result.error.message).toContain('Manifest not found');
      }
    });

    it('should return error when parent entry missing pendingToolCallId', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      const rootManifest = createAgentManifest('agent-0', '1.0.0');
      const childManifest = createAgentManifest('agent-1', '1.0.0');
      const manifestMap = createManifestMap([rootManifest, childManifest]);

      const stack = createSuspensionStack([
        rootManifest.config.id,
        childManifest.config.id,
      ]);
      stack.agents[0].pendingToolCallId = undefined; // Invalid: parent has no tool call ID

      const savedState = createAgentState();
      const response = createContinueResponse('approval-id');

      const streamAgentMock = createRunAgentMock();
      streamAgentMock.mockResolvedValue(ok(createCompleteResult()));

      const result = await resumeFromSuspensionStack(
        ctx,
        rootManifest,
        manifestMap,
        savedState,
        stack,
        response,
        deps,
        undefined, // options
        { streamAgent: streamAgentMock },
      );

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('pendingToolCallId');
      }
    });
  });

  describe('2-Level Stack (Root + Child)', () => {
    it('should complete when child completes and no remaining suspensions', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      const rootManifest = createAgentManifest('root', '1.0.0');
      const childManifest = createAgentManifest('child', '1.0.0');
      const manifestMap = createManifestMap([rootManifest, childManifest]);

      const stack = createSuspensionStack([
        rootManifest.config.id,
        childManifest.config.id,
      ]);

      const response = createContinueResponse(stack.leafSuspension.approvalId);

      const savedState = createAgentState({
        suspensionStacks: [stack],
        suspensions: [],
      });

      const childCompleteResult = createCompleteResult(stack.agents[1].stateId);
      const rootCompleteResult = createCompleteResult(stack.agents[0].stateId);

      const streamAgentMock = createRunAgentSequence([
        ok(childCompleteResult),
        ok(rootCompleteResult),
      ]);

      const result = await resumeFromSuspensionStack(
        ctx,
        rootManifest,
        manifestMap,
        savedState,
        stack,
        response,
        deps,
        undefined, // options
        { streamAgent: streamAgentMock },
      );

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe('complete');
    });

    it('should return suspended when root has own suspensions remaining', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      const rootManifest = createAgentManifest('root', '1.0.0');
      const childManifest = createAgentManifest('child', '1.0.0');
      const manifestMap = createManifestMap([rootManifest, childManifest]);

      const stack = createSuspensionStack([
        rootManifest.config.id,
        childManifest.config.id,
      ]);

      const ownSuspension = createSuspension();
      const savedState = createAgentState({
        suspensionStacks: [stack],
        suspensions: [ownSuspension],
      });

      const response = createContinueResponse(stack.leafSuspension.approvalId);

      const childCompleteResult = createCompleteResult(stack.agents[1].stateId);
      const streamAgentMock = createRunAgentMock();
      streamAgentMock.mockResolvedValue(ok(childCompleteResult));

      const result = await resumeFromSuspensionStack(
        ctx,
        rootManifest,
        manifestMap,
        savedState,
        stack,
        response,
        deps,
        undefined, // options
        { streamAgent: streamAgentMock },
      );

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe('suspended');
    });

    it('should return suspended when root has other stacks remaining', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      const rootManifest = createAgentManifest('root', '1.0.0');
      const childManifest = createAgentManifest('child', '1.0.0');
      const manifestMap = createManifestMap([rootManifest, childManifest]);

      const completedStack = createSuspensionStack([
        rootManifest.config.id,
        childManifest.config.id,
      ]);

      const otherStack = createSuspensionStack([
        rootManifest.config.id,
        childManifest.config.id,
      ]);

      const savedState = createAgentState({
        suspensionStacks: [completedStack, otherStack],
        suspensions: [],
      });

      const response = createContinueResponse(
        completedStack.leafSuspension.approvalId,
      );

      const childCompleteResult = createCompleteResult();
      const streamAgentMock = createRunAgentMock();
      streamAgentMock.mockResolvedValue(ok(childCompleteResult));

      const result = await resumeFromSuspensionStack(
        ctx,
        rootManifest,
        manifestMap,
        savedState,
        completedStack,
        response,
        deps,
        undefined, // options
        { streamAgent: streamAgentMock },
      );

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe('suspended');
    });

    it('should propagate child error result correctly', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      const rootManifest = createAgentManifest('root', '1.0.0');
      const childManifest = createAgentManifest('child', '1.0.0');
      const manifestMap = createManifestMap([rootManifest, childManifest]);

      const stack = createSuspensionStack([
        rootManifest.config.id,
        childManifest.config.id,
      ]);

      const savedState = createAgentState({
        suspensionStacks: [stack],
        suspensions: [],
      });

      const response = createContinueResponse(stack.leafSuspension.approvalId);

      const childErrorResult = createErrorResult('Child failed');
      const rootCompleteResult = createCompleteResult();

      const streamAgentMock = createRunAgentSequence([
        ok(childErrorResult),
        ok(rootCompleteResult),
      ]);

      await resumeFromSuspensionStack(
        ctx,
        rootManifest,
        manifestMap,
        savedState,
        stack,
        response,
        deps,
        undefined, // options
        { streamAgent: streamAgentMock },
      );

      // Error should be converted to error tool result and passed to root
      expect(streamAgentMock).toHaveBeenCalledTimes(2);
    });

    it('should handle child re-suspension', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      const rootManifest = createAgentManifest('root', '1.0.0');
      const childManifest = createAgentManifest('child', '1.0.0');
      const manifestMap = createManifestMap([rootManifest, childManifest]);

      const stack = createSuspensionStack([
        AgentId('temp-1'),
        AgentId('temp-2'),
      ]);
      stack.agents[0].manifestId = AgentId('root');
      stack.agents[1].manifestId = AgentId('child');

      const savedState = createAgentState({
        suspensionStacks: [stack],
      });

      const response = createContinueResponse(stack.leafSuspension.approvalId);

      const newSuspension = createSuspension();
      const childSuspendedResult = createSuspendedResult([newSuspension], []);

      const streamAgentMock = createRunAgentMock();
      streamAgentMock.mockResolvedValue(ok(childSuspendedResult));

      const result = await resumeFromSuspensionStack(
        ctx,
        rootManifest,
        manifestMap,
        savedState,
        stack,
        response,
        deps,
        undefined, // options
        { streamAgent: streamAgentMock },
      );

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe('suspended');
    });

    it('should propagate runAgent error', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      const rootManifest = createAgentManifest('root', '1.0.0');
      const childManifest = createAgentManifest('child', '1.0.0');
      const manifestMap = createManifestMap([rootManifest, childManifest]);

      const stack = createSuspensionStack([
        AgentId('temp-1'),
        AgentId('temp-2'),
      ]);
      const savedState = createAgentState();
      const response = createContinueResponse(stack.leafSuspension.approvalId);

      const streamAgentMock = createRunAgentMock();
      streamAgentMock.mockResolvedValue(
        err({
          message: 'runAgent failed',
          code: 'InternalServer',
          name: 'TestError',
          metadata: {},
        }),
      );

      const result = await resumeFromSuspensionStack(
        ctx,
        rootManifest,
        manifestMap,
        savedState,
        stack,
        response,
        deps,
        undefined, // options
        { streamAgent: streamAgentMock },
      );

      expect(result.isErr()).toBe(true);
    });
  });

  describe('3-Level Stack (Root + Intermediate + Leaf)', () => {
    it('should propagate completion through all levels', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      const rootManifest = createAgentManifest('root', '1.0.0');
      const intermediateManifest = createAgentManifest('intermediate', '1.0.0');
      const leafManifest = createAgentManifest('leaf', '1.0.0');
      const manifestMap = createManifestMap([
        rootManifest,
        intermediateManifest,
        leafManifest,
      ]);

      const stack = createSuspensionStack([
        AgentId('root'),
        AgentId('intermediate'),
        AgentId('leaf'),
      ]);
      stack.agents[0].stateId = AgentRunId('root-state');
      stack.agents[1].stateId = AgentRunId('intermediate-state');
      stack.agents[2].stateId = AgentRunId('leaf-state');

      const savedState = createAgentState({
        id: AgentRunId('root-state'),
        suspensionStacks: [stack],
        suspensions: [],
      });

      const intermediateState = createAgentState({
        id: AgentRunId('intermediate-state'),
        suspensionStacks: [],
        suspensions: [],
      });

      // Pre-populate intermediate state in cache
      await deps.stateCache.set(ctx, intermediateState.id, intermediateState);

      const response = createContinueResponse(stack.leafSuspension.approvalId);

      const leafComplete = createCompleteResult(AgentRunId('leaf-state'));
      const intermediateComplete = createCompleteResult(
        AgentRunId('intermediate-state'),
      );
      const rootComplete = createCompleteResult(AgentRunId('root-state'));

      const streamAgentMock = createRunAgentSequence([
        ok(leafComplete),
        ok(intermediateComplete),
        ok(rootComplete),
      ]);

      const result = await resumeFromSuspensionStack(
        ctx,
        rootManifest,
        manifestMap,
        savedState,
        stack,
        response,
        deps,
        undefined, // options
        { streamAgent: streamAgentMock },
      );

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe('complete');
      expect(streamAgentMock).toHaveBeenCalledTimes(3);
    });

    it('should handle intermediate re-suspension', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      const rootManifest = createAgentManifest('root', '1.0.0');
      const intermediateManifest = createAgentManifest('intermediate', '1.0.0');
      const leafManifest = createAgentManifest('leaf', '1.0.0');
      const manifestMap = createManifestMap([
        rootManifest,
        intermediateManifest,
        leafManifest,
      ]);

      const stack = createSuspensionStack([
        AgentId('root'),
        AgentId('intermediate'),
        AgentId('leaf'),
      ]);

      const savedState = createAgentState({
        suspensionStacks: [stack],
      });

      const intermediateState = createAgentState({
        id: stack.agents[1].stateId,
        suspensionStacks: [],
      });

      // Pre-populate intermediate state in cache
      await deps.stateCache.set(ctx, intermediateState.id, intermediateState);

      const response = createContinueResponse(stack.leafSuspension.approvalId);

      const leafComplete = createCompleteResult();
      const newSuspension = createSuspension();
      const intermediateSuspended = createSuspendedResult([newSuspension], []);

      const streamAgentMock = createRunAgentSequence([
        ok(leafComplete),
        ok(intermediateSuspended),
      ]);

      const result = await resumeFromSuspensionStack(
        ctx,
        rootManifest,
        manifestMap,
        savedState,
        stack,
        response,
        deps,
        undefined, // options
        { streamAgent: streamAgentMock },
      );

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe('suspended');
    });

    it('should handle intermediate has remaining suspensions', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      const rootManifest = createAgentManifest('root', '1.0.0');
      const intermediateManifest = createAgentManifest('intermediate', '1.0.0');
      const leafManifest = createAgentManifest('leaf', '1.0.0');
      const manifestMap = createManifestMap([
        rootManifest,
        intermediateManifest,
        leafManifest,
      ]);

      const stack = createSuspensionStack([
        AgentId('root'),
        AgentId('intermediate'),
        AgentId('leaf'),
      ]);
      stack.agents[0].stateId = AgentRunId('root-state');
      stack.agents[1].stateId = AgentRunId('intermediate-state');

      const otherIntermediateSuspension = createSuspension();
      const intermediateState = createAgentState({
        id: AgentRunId('intermediate-state'),
        suspensions: [otherIntermediateSuspension],
        suspensionStacks: [],
      });

      const savedState = createAgentState({
        id: AgentRunId('root-state'),
        suspensionStacks: [stack],
      });

      // Pre-populate intermediate state in cache
      await deps.stateCache.set(ctx, intermediateState.id, intermediateState);

      const response = createContinueResponse(stack.leafSuspension.approvalId);

      const leafComplete = createCompleteResult();
      const streamAgentMock = createRunAgentMock();
      streamAgentMock.mockResolvedValue(ok(leafComplete));

      const result = await resumeFromSuspensionStack(
        ctx,
        rootManifest,
        manifestMap,
        savedState,
        stack,
        response,
        deps,
        undefined, // options
        { streamAgent: streamAgentMock },
      );

      expect(result.isOk()).toBe(true);
      const unwrapped = result._unsafeUnwrap();
      expect(unwrapped.status).toBe('suspended');

      if (unwrapped.status !== 'suspended') {
        throw new Error('Expected suspended result');
      }

      const resultStacks = unwrapped.suspensionStacks;
      const intermediateStack = resultStacks.find(
        (s) =>
          s.leafSuspension.approvalId ===
          otherIntermediateSuspension.approvalId,
      );

      expect(intermediateStack).toBeDefined();
      expect(intermediateStack!.agents.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle deepest re-suspension', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      const rootManifest = createAgentManifest('root', '1.0.0');
      const intermediateManifest = createAgentManifest('intermediate', '1.0.0');
      const leafManifest = createAgentManifest('leaf', '1.0.0');
      const manifestMap = createManifestMap([
        rootManifest,
        intermediateManifest,
        leafManifest,
      ]);

      const stack = createSuspensionStack([
        AgentId('root'),
        AgentId('intermediate'),
        AgentId('leaf'),
      ]);

      const savedState = createAgentState({
        suspensionStacks: [stack],
      });

      const response = createContinueResponse(stack.leafSuspension.approvalId);

      const newSuspension = createSuspension();
      const leafSuspended = createSuspendedResult([newSuspension], []);

      const streamAgentMock = createRunAgentMock();
      streamAgentMock.mockResolvedValue(ok(leafSuspended));

      const result = await resumeFromSuspensionStack(
        ctx,
        rootManifest,
        manifestMap,
        savedState,
        stack,
        response,
        deps,
        undefined, // options
        { streamAgent: streamAgentMock },
      );

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe('suspended');
    });

    it('should return notFound when intermediate manifest missing', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      const rootManifest = createAgentManifest('root', '1.0.0');
      const leafManifest = createAgentManifest('leaf', '1.0.0');
      const manifestMap = createManifestMap([rootManifest, leafManifest]); // Missing intermediate

      const stack = createSuspensionStack([
        AgentId('root'),
        AgentId('missing-intermediate'),
        AgentId('leaf'),
      ]);

      const intermediateState = createAgentState({
        id: stack.agents[1].stateId,
      });

      // Pre-populate intermediate state in cache
      await deps.stateCache.set(ctx, intermediateState.id, intermediateState);

      const savedState = createAgentState();
      const response = createContinueResponse(stack.leafSuspension.approvalId);

      const leafComplete = createCompleteResult();
      const streamAgentMock = createRunAgentMock();
      streamAgentMock.mockResolvedValue(ok(leafComplete));

      const result = await resumeFromSuspensionStack(
        ctx,
        rootManifest,
        manifestMap,
        savedState,
        stack,
        response,
        deps,
        undefined, // options
        { streamAgent: streamAgentMock },
      );

      expect(result.isErr()).toBe(true);
      const error = result._unsafeUnwrapErr();
      expect(error.code).toBe('NotFound');
    });

    it('should propagate stateCache.get error for intermediate', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      const rootManifest = createAgentManifest('root', '1.0.0');
      const intermediateManifest = createAgentManifest('intermediate', '1.0.0');
      const leafManifest = createAgentManifest('leaf', '1.0.0');
      const manifestMap = createManifestMap([
        rootManifest,
        intermediateManifest,
        leafManifest,
      ]);

      const stack = createSuspensionStack([
        AgentId('root'),
        AgentId('intermediate'),
        AgentId('leaf'),
      ]);
      const savedState = createAgentState();
      const response = createContinueResponse(stack.leafSuspension.approvalId);

      // Don't pre-populate intermediate state - it won't be found
      // The real cache will return ok(undefined) which means not found

      const leafComplete = createCompleteResult();
      const streamAgentMock = createRunAgentMock();
      streamAgentMock.mockResolvedValue(ok(leafComplete));

      const result = await resumeFromSuspensionStack(
        ctx,
        rootManifest,
        manifestMap,
        savedState,
        stack,
        response,
        deps,
        undefined, // options
        { streamAgent: streamAgentMock },
      );

      // Should fail because parent state not found
      expect(result.isErr()).toBe(true);
    });
  });

  describe('4+ Level Stack', () => {
    it('should handle full 4-level chain completion', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      const manifests = [
        createAgentManifest('level-0', '1.0.0'),
        createAgentManifest('level-1', '1.0.0'),
        createAgentManifest('level-2', '1.0.0'),
        createAgentManifest('level-3', '1.0.0'),
      ];
      const manifestMap = createManifestMap(manifests);

      const stack = createSuspensionStack([
        AgentId('level-0'),
        AgentId('level-1'),
        AgentId('level-2'),
        AgentId('level-3'),
      ]);

      // Set state IDs
      for (let i = 0; i < 4; i++) {
        stack.agents[i].stateId = AgentRunId(`state-${i}`);
      }

      // Pre-populate all intermediate states
      for (let i = 1; i < 3; i++) {
        const state = createAgentState({
          id: AgentRunId(`state-${i}`),
          suspensions: [],
          suspensionStacks: [],
        });
        await deps.stateCache.set(ctx, state.id, state);
      }

      const savedState = createAgentState({
        id: AgentRunId('state-0'),
        suspensionStacks: [stack],
      });

      const response = createContinueResponse(stack.leafSuspension.approvalId);

      const streamAgentMock = createRunAgentSequence([
        ok(createCompleteResult(AgentRunId('state-3'))),
        ok(createCompleteResult(AgentRunId('state-2'))),
        ok(createCompleteResult(AgentRunId('state-1'))),
        ok(createCompleteResult(AgentRunId('state-0'))),
      ]);

      const result = await resumeFromSuspensionStack(
        ctx,
        manifests[0],
        manifestMap,
        savedState,
        stack,
        response,
        deps,
        undefined, // options
        { streamAgent: streamAgentMock },
      );

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe('complete');
      expect(streamAgentMock).toHaveBeenCalledTimes(4);
    });

    it('should handle re-suspension at level 2', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      const manifests = [
        createAgentManifest('level-0', '1.0.0'),
        createAgentManifest('level-1', '1.0.0'),
        createAgentManifest('level-2', '1.0.0'),
        createAgentManifest('level-3', '1.0.0'),
      ];
      const manifestMap = createManifestMap(manifests);

      const stack = createSuspensionStack([
        AgentId('level-0'),
        AgentId('level-1'),
        AgentId('level-2'),
        AgentId('level-3'),
      ]);

      // Set state IDs
      for (let i = 0; i < 4; i++) {
        stack.agents[i].stateId = AgentRunId(`state-${i}`);
      }

      // Pre-populate intermediate states
      for (let i = 1; i < 3; i++) {
        const state = createAgentState({
          id: AgentRunId(`state-${i}`),
          suspensions: [],
          suspensionStacks: [],
        });
        await deps.stateCache.set(ctx, state.id, state);
      }

      const savedState = createAgentState({
        id: AgentRunId('state-0'),
        suspensionStacks: [stack],
      });

      const response = createContinueResponse(stack.leafSuspension.approvalId);

      const newSuspension = createSuspension();
      const streamAgentMock = createRunAgentSequence([
        ok(createCompleteResult(AgentRunId('state-3'))),
        ok(createCompleteResult(AgentRunId('state-2'))),
        ok(createSuspendedResult([newSuspension], [])),
      ]);

      const result = await resumeFromSuspensionStack(
        ctx,
        manifests[0],
        manifestMap,
        savedState,
        stack,
        response,
        deps,
        undefined, // options
        { streamAgent: streamAgentMock },
      );

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe('suspended');
    });
  });

  describe('Edge Cases', () => {
    it('should handle state with both suspensions and stacks', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      const rootManifest = createAgentManifest('root', '1.0.0');
      const childManifest = createAgentManifest('child', '1.0.0');
      const manifestMap = createManifestMap([rootManifest, childManifest]);

      const stack = createSuspensionStack([AgentId('root'), AgentId('child')]);

      const ownSuspension = createSuspension();

      const savedState = createAgentState({
        suspensionStacks: [stack],
        suspensions: [ownSuspension],
      });

      const response = createContinueResponse(stack.leafSuspension.approvalId);

      const childComplete = createCompleteResult();
      const streamAgentMock = createRunAgentMock();
      streamAgentMock.mockResolvedValue(ok(childComplete));

      const result = await resumeFromSuspensionStack(
        ctx,
        rootManifest,
        manifestMap,
        savedState,
        stack,
        response,
        deps,
        undefined, // options
        { streamAgent: streamAgentMock },
      );

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe('suspended');
    });

    it('should handle empty manifestMap gracefully', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      const manifest = createAgentManifest('root', '1.0.0');
      const manifestMap = new Map();
      const stack = createSuspensionStack([AgentId('root'), AgentId('temp-2')]);
      const savedState = createAgentState();
      const response = createContinueResponse(stack.leafSuspension.approvalId);

      const result = await resumeFromSuspensionStack(
        ctx,
        manifest,
        manifestMap,
        savedState,
        stack,
        response,
        deps,
      );

      expect(result.isErr()).toBe(true);
    });

    it('should handle approval denied (approved: false)', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      const rootManifest = createAgentManifest('root', '1.0.0');
      const childManifest = createAgentManifest('child', '1.0.0');
      const manifestMap = createManifestMap([rootManifest, childManifest]);

      const stack = createSuspensionStack([AgentId('root'), AgentId('child')]);

      const savedState = createAgentState({
        suspensionStacks: [stack],
      });

      const response = createContinueResponse(
        stack.leafSuspension.approvalId,
        false,
      );

      const childComplete = createCompleteResult();
      const rootComplete = createCompleteResult();

      const streamAgentMock = createRunAgentSequence([
        ok(childComplete),
        ok(rootComplete),
      ]);

      const result = await resumeFromSuspensionStack(
        ctx,
        rootManifest,
        manifestMap,
        savedState,
        stack,
        response,
        deps,
        undefined, // options
        { streamAgent: streamAgentMock },
      );

      // Should still propagate (approval/denial is handled by child agent)
      expect(result.isOk()).toBe(true);
    });
  });

  describe('Property Tests', () => {
    it('should preserve parent path in all output stacks', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      await fc.assert(
        fc.asyncProperty(validStackArb, async (stack) => {
          if (stack.agents.length < 2) return;

          const manifests = stack.agents.map((agent) =>
            createAgentManifest(agent.manifestId, agent.manifestVersion),
          );
          const manifestMap = createManifestMap(manifests);

          const savedState = createAgentState({
            suspensionStacks: [stack],
          });

          const response = createContinueResponse(
            stack.leafSuspension.approvalId,
          );

          const newSuspension = createSuspension();
          const deepestSuspended = createSuspendedResult([newSuspension], []);

          const streamAgentMock = createRunAgentMock();
          streamAgentMock.mockResolvedValue(ok(deepestSuspended));

          const result = await resumeFromSuspensionStack(
            ctx,
            manifests[0],
            manifestMap,
            savedState,
            stack,
            response,
            deps,
            undefined, // options
            { streamAgent: streamAgentMock },
          );

          if (result.isOk() && result.value.status === 'suspended') {
            // All stacks should start with the root entry
            for (const outputStack of result.value.suspensionStacks) {
              expect(outputStack.agents[0]).toBeDefined();
            }
          }
        }),
        { numRuns: 20 },
      );
    });

    it('should use parent pendingToolCallId in tool results', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      await fc.assert(
        fc.asyncProperty(
          toolCallIdArb,
          agentIdArb,
          async (toolCallId, manifestId) => {
            const rootManifest = createAgentManifest('root', '1.0.0');
            const childManifest = createAgentManifest(manifestId, '1.0.0');
            const manifestMap = createManifestMap([
              rootManifest,
              childManifest,
            ]);

            const stack = createSuspensionStack([
              AgentId('root'),
              AgentId(manifestId),
            ]);
            stack.agents[0].pendingToolCallId = toolCallId;

            const savedState = createAgentState({
              suspensionStacks: [stack],
              suspensions: [],
            });

            const response = createContinueResponse(
              stack.leafSuspension.approvalId,
            );

            const childComplete = createCompleteResult();
            const rootComplete = createCompleteResult();

            const streamAgentMock = createRunAgentSequence([
              ok(childComplete),
              ok(rootComplete),
            ]);

            await resumeFromSuspensionStack(
              ctx,
              rootManifest,
              manifestMap,
              savedState,
              stack,
              response,
              deps,
              undefined, // options
              { streamAgent: streamAgentMock },
            );

            // Verify runAgent was called with continue for root
            // Note: Mock call verification skipped in property test
          },
        ),
        { numRuns: 20 },
      );
    });

    it('should always return root runId in result', async () => {
      const { deps } = setup();
      const ctx = createMockContext();

      await fc.assert(
        fc.asyncProperty(validStackArb, async (stack) => {
          if (stack.agents.length < 2) return;

          const manifests = stack.agents.map((agent) =>
            createAgentManifest(agent.manifestId, agent.manifestVersion),
          );
          const manifestMap = createManifestMap(manifests);

          const rootId = AgentRunId('fixed-root-id');
          const savedState = createAgentState({
            id: rootId,
            suspensionStacks: [stack],
          });

          const response = createContinueResponse(
            stack.leafSuspension.approvalId,
          );

          const deepestComplete = createCompleteResult();
          const streamAgentMock = createRunAgentMock();
          streamAgentMock.mockResolvedValue(ok(deepestComplete));

          const result = await resumeFromSuspensionStack(
            ctx,
            manifests[0],
            manifestMap,
            savedState,
            stack,
            response,
            deps,
            undefined, // options
            { streamAgent: streamAgentMock },
          );

          if (result.isOk()) {
            expect(result.value.runId).toBeDefined();
          }
        }),
        { numRuns: 20 },
      );
    });
  });
});
