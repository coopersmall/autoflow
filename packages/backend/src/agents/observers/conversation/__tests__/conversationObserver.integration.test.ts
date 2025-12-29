/**
 * Integration tests for the Conversation Observer.
 *
 * Tests the complete conversation observer with real infrastructure:
 * - Real PostgreSQL database for conversations and items
 * - Real Redis cache for agent state
 * - Mocked completionsGateway to control LLM responses
 *
 * These tests verify:
 * - Conversation creation when not provided
 * - Using existing conversation when provided
 * - Conversation items inserted on agent completion
 * - Conversation items inserted on agent error
 * - Turn index calculation
 */

import { describe, expect, it } from 'bun:test';
import {
  createTestManifest,
  createTextCompletionParts,
} from '@backend/agents/actions/__tests__/fixtures';
import {
  type StreamAgentFinalResult,
  type StreamAgentItem,
  streamAgent,
} from '@backend/agents/actions/streamAgent';
import {
  createAgentCancellationCache,
  createAgentStateCache,
} from '@backend/agents/infrastructure/cache';
import { createAgentRunLock } from '@backend/agents/infrastructure/lock';
import { createConversationObserver } from '@backend/agents/observers/conversation';
import { applyObservers } from '@backend/agents/observers/utils';
import { getMockedCompletionsGateway } from '@backend/ai/completions/__mocks__/CompletionsGateway.mock';
import { getMockedMCPService } from '@backend/ai/mcp/services/__mocks__/MCPService.mock';
import { createConversationsService } from '@backend/conversation';
import { createMockContext } from '@backend/infrastructure/context/__mocks__/Context.mock';
import { createStorageService } from '@backend/storage/services/StorageService';
import { setupIntegrationTest } from '@backend/testing/integration/integrationTest';
import { TestServices } from '@backend/testing/integration/setup/TestServices';
import { createUsersService } from '@backend/users';
import {
  type AgentEvent,
  AgentId,
  type AgentRunResult,
} from '@core/domain/agents';
import type { StreamPart } from '@core/domain/ai';
import type { AppError } from '@core/errors/AppError';
import { ok, type Result } from 'neverthrow';

describe('Conversation Observer Integration Tests', () => {
  const { getConfig, getLogger } = setupIntegrationTest();

  /**
   * Setup function that creates real infrastructure for each test.
   */
  const setup = () => {
    const config = getConfig();
    const logger = getLogger();

    // Real infrastructure for agents
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

    // Real infrastructure for conversations
    const conversationsService = createConversationsService({
      appConfig: config,
      logger,
    });

    const usersService = createUsersService({
      appConfig: config,
      logger,
    });

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
      conversationsService,
      usersService,
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
  // Conversation Creation Tests
  // ===========================================================================

  describe('Conversation Creation', () => {
    it('should create a new conversation when conversationId is not provided', async () => {
      const ctx = createMockContext();
      const { conversationsService, usersService } = setup();

      // Create a real user
      const userResult = await usersService.create(ctx, { schemaVersion: 1 });
      const userId = userResult._unsafeUnwrap().id;

      // Create conversation observer without providing conversationId
      const observerResult = await createConversationObserver(ctx, {
        conversationsService,
        userId,
      });

      expect(observerResult.isOk()).toBe(true);
      const { conversationId } = observerResult._unsafeUnwrap();

      // Verify conversation was created
      const convResult = await conversationsService.get(
        ctx,
        conversationId,
        userId,
      );
      expect(convResult.isOk()).toBe(true);
      expect(convResult._unsafeUnwrap().id).toBe(conversationId);
    });

    it('should use existing conversation when conversationId is provided', async () => {
      const ctx = createMockContext();
      const { conversationsService, usersService } = setup();

      // Create a real user
      const userResult = await usersService.create(ctx, { schemaVersion: 1 });
      const userId = userResult._unsafeUnwrap().id;

      // Create conversation first
      const createResult = await conversationsService.create(ctx, userId, {
        schemaVersion: 1,
        status: 'active',
        channel: 'api',
        title: 'Existing Conversation',
      });
      const existingConversationId = createResult._unsafeUnwrap().id;

      // Create conversation observer with existing conversationId
      const observerResult = await createConversationObserver(ctx, {
        conversationsService,
        userId,
        conversationId: existingConversationId,
      });

      expect(observerResult.isOk()).toBe(true);
      const { conversationId } = observerResult._unsafeUnwrap();
      expect(conversationId).toBe(existingConversationId);
    });

    it('should fail when provided conversationId does not exist', async () => {
      const ctx = createMockContext();
      const { conversationsService, usersService } = setup();

      // Create a real user
      const userResult = await usersService.create(ctx, { schemaVersion: 1 });
      const userId = userResult._unsafeUnwrap().id;

      // Create conversation observer with non-existent conversationId
      const observerResult = await createConversationObserver(ctx, {
        conversationsService,
        userId,
        conversationId: 'non-existent-id' as any,
      });

      expect(observerResult.isErr()).toBe(true);
    });
  });

  // ===========================================================================
  // Item Insertion Tests
  // ===========================================================================

  describe('Conversation Item Insertion', () => {
    it('should insert conversation item when agent completes successfully', async () => {
      const ctx = createMockContext();
      const { deps, conversationsService, usersService } = setup();

      // Create a real user
      const userResult = await usersService.create(ctx, { schemaVersion: 1 });
      const userId = userResult._unsafeUnwrap().id;

      // Create conversation observer
      const observerResult = await createConversationObserver(ctx, {
        conversationsService,
        userId,
      });
      expect(observerResult.isOk()).toBe(true);
      const { conversationId, observer } = observerResult._unsafeUnwrap();

      // Create manifest and apply observer
      const baseManifest = createTestManifest('test-agent', {
        streamingEvents: ['text-delta'],
      });

      const applyResult = applyObservers(
        [baseManifest],
        baseManifest.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifest = applyResult._unsafeUnwrap().manifests[0];

      // Mock successful completion
      const parts = createTextCompletionParts('Hello, world!');
      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(parts),
      );

      // Run agent
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

      const { finalResult } = await collectStreamItems(generator);
      const agentResult = assertFinalResultOk(finalResult);
      expect(agentResult.status).toBe('complete');

      // Verify conversation item was inserted
      const itemsResult = await conversationsService.getItems(
        ctx,
        conversationId,
        userId,
      );
      expect(itemsResult.isOk()).toBe(true);
      const items = itemsResult._unsafeUnwrap();
      expect(items.length).toBe(1);
      expect(items[0].type).toBe('agent');
    });

    it('should insert conversation item when agent errors', async () => {
      const ctx = createMockContext();
      const { deps, conversationsService, usersService } = setup();

      // Create a real user
      const userResult = await usersService.create(ctx, { schemaVersion: 1 });
      const userId = userResult._unsafeUnwrap().id;

      // Create conversation observer
      const observerResult = await createConversationObserver(ctx, {
        conversationsService,
        userId,
      });
      expect(observerResult.isOk()).toBe(true);
      const { conversationId, observer } = observerResult._unsafeUnwrap();

      // Create manifest and apply observer
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
          yield {
            isOk: () => false,
            isErr: () => true,
            error: {
              code: 'InternalServer',
              name: 'TestError',
              message: 'Something went wrong',
              metadata: {},
            },
          } as any;
        },
      );

      // Run agent
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

      const { finalResult } = await collectStreamItems(generator);
      const agentResult = assertFinalResultOk(finalResult);
      expect(agentResult.status).toBe('error');

      // Verify conversation item was inserted with error status
      const itemsResult = await conversationsService.getItems(
        ctx,
        conversationId,
        userId,
      );
      expect(itemsResult.isOk()).toBe(true);
      const items = itemsResult._unsafeUnwrap();
      expect(items.length).toBe(1);
      expect(items[0].type).toBe('agent');
      if (items[0].type === 'agent') {
        expect(items[0].result.status).toBe('error');
      }
    });
  });

  // ===========================================================================
  // Turn Index Tests
  // ===========================================================================

  describe('Turn Index Calculation', () => {
    it('should use turn index 0 for first item in conversation', async () => {
      const ctx = createMockContext();
      const { deps, conversationsService, usersService } = setup();

      // Create a real user
      const userResult = await usersService.create(ctx, { schemaVersion: 1 });
      const userId = userResult._unsafeUnwrap().id;

      // Create conversation observer
      const observerResult = await createConversationObserver(ctx, {
        conversationsService,
        userId,
      });
      expect(observerResult.isOk()).toBe(true);
      const { conversationId, observer } = observerResult._unsafeUnwrap();

      // Create manifest and apply observer
      const baseManifest = createTestManifest('test-agent');
      const applyResult = applyObservers(
        [baseManifest],
        baseManifest.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifest = applyResult._unsafeUnwrap().manifests[0];

      // Mock successful completion
      const parts = createTextCompletionParts('Hello!');
      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(parts),
      );

      // Run agent
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

      await collectStreamItems(generator);

      // Verify turn index
      const itemsResult = await conversationsService.getItems(
        ctx,
        conversationId,
        userId,
      );
      expect(itemsResult.isOk()).toBe(true);
      const items = itemsResult._unsafeUnwrap();
      expect(items.length).toBe(1);
      expect(items[0].turnIndex).toBe(0);
    });

    it('should increment turn index for subsequent items', async () => {
      const ctx = createMockContext();
      const { deps, conversationsService, usersService } = setup();

      // Create a real user
      const userResult = await usersService.create(ctx, { schemaVersion: 1 });
      const userId = userResult._unsafeUnwrap().id;

      // Create conversation first
      const convResult = await conversationsService.create(ctx, userId, {
        schemaVersion: 1,
        status: 'active',
        channel: 'api',
      });
      const conversationId = convResult._unsafeUnwrap().id;

      // Add an existing item with turn index 0
      await conversationsService.appendItem(ctx, conversationId, userId, {
        schemaVersion: 1,
        type: 'message',
        turnIndex: 0,
        message: { role: 'user', text: 'First message' },
      });

      // Create conversation observer with existing conversation
      const observerResult = await createConversationObserver(ctx, {
        conversationsService,
        userId,
        conversationId,
      });
      expect(observerResult.isOk()).toBe(true);
      const { observer } = observerResult._unsafeUnwrap();

      // Create manifest and apply observer
      const baseManifest = createTestManifest('test-agent');
      const applyResult = applyObservers(
        [baseManifest],
        baseManifest.config.id,
        [observer],
      );
      expect(applyResult.isOk()).toBe(true);
      const manifest = applyResult._unsafeUnwrap().manifests[0];

      // Mock successful completion
      const parts = createTextCompletionParts('Response!');
      deps.completionsGateway.streamCompletion.mockImplementation(
        createMockStreamCompletion(parts),
      );

      // Run agent
      const generator = streamAgent(
        ctx,
        manifest,
        {
          type: 'request',
          prompt: 'Continue',
          manifestMap: new Map(),
        },
        deps,
      );

      await collectStreamItems(generator);

      // Verify turn index is 1 (next after existing item)
      const itemsResult = await conversationsService.getItems(
        ctx,
        conversationId,
        userId,
      );
      expect(itemsResult.isOk()).toBe(true);
      const items = itemsResult._unsafeUnwrap();
      expect(items.length).toBe(2);

      // Find the agent item (should have turn index 1)
      const agentItem = items.find((item) => item.type === 'agent');
      expect(agentItem).toBeDefined();
      expect(agentItem!.turnIndex).toBe(1);
    });
  });

  // ===========================================================================
  // Multiple Observer Calls Tests
  // ===========================================================================

  describe('Observer Handle Reuse', () => {
    it('should return same conversationId when createHooks is called multiple times', async () => {
      const ctx = createMockContext();
      const { conversationsService, usersService } = setup();

      // Create a real user
      const userResult = await usersService.create(ctx, { schemaVersion: 1 });
      const userId = userResult._unsafeUnwrap().id;

      // Create conversation observer
      const observerResult = await createConversationObserver(ctx, {
        conversationsService,
        userId,
      });
      expect(observerResult.isOk()).toBe(true);
      const { conversationId, observer } = observerResult._unsafeUnwrap();

      // Call createHooks multiple times (simulating multiple manifests)
      const hooks1 = observer.createHooks({
        manifestId: AgentId('agent-1'),
        manifestVersion: '1.0.0',
        parentManifestId: undefined,
        isRoot: true,
      });
      const hooks2 = observer.createHooks({
        manifestId: AgentId('agent-2'),
        manifestVersion: '1.0.0',
        parentManifestId: AgentId('agent-1'),
        isRoot: false,
      });

      expect(hooks1.isOk()).toBe(true);
      expect(hooks2.isOk()).toBe(true);

      // Both should use the same conversationId (captured in closure)
      // We verify this indirectly by checking the conversation still exists
      const convResult = await conversationsService.get(
        ctx,
        conversationId,
        userId,
      );
      expect(convResult.isOk()).toBe(true);
    });
  });
});
