import { describe, expect, it } from 'bun:test';
import {
  type AppendItemData,
  createConversationsService,
} from '@backend/conversation';
import { createConversationsCache } from '@backend/conversation/cache/ConversationsCache';
import { createConversationItemsRepo } from '@backend/conversation/repos/ConversationItemsRepo';
import { createConversationsRepo } from '@backend/conversation/repos/ConversationsRepo';
import { createMockContext } from '@backend/infrastructure/context/__mocks__/Context.mock';
import { setupIntegrationTest } from '@backend/testing/integration/integrationTest';
import { createUsersService } from '@backend/users';
import type { Channel } from '@core/domain/channel/Channel';
import {
  ConversationItemId,
  type ConversationStatus,
  type MessageItem,
  type UserMessageBody,
} from '@core/domain/conversation';
import * as fc from 'fast-check';

describe('ConversationsService Integration Tests', () => {
  const { getConfig, getLogger } = setupIntegrationTest();

  const setup = () => {
    const config = getConfig();
    const logger = getLogger();

    const usersService = createUsersService({
      appConfig: config,
      logger,
    });

    const conversationsService = createConversationsService({
      appConfig: config,
      logger,
    });

    const conversationsRepo = createConversationsRepo({ appConfig: config });
    const conversationsCache = createConversationsCache({
      appConfig: config,
      logger,
    });
    const conversationItemsRepo = createConversationItemsRepo({
      appConfig: config,
    });

    return {
      usersService,
      conversationsService,
      conversationsRepo,
      conversationsCache,
      conversationItemsRepo,
    };
  };

  // === ARBITRARIES FOR PROPERTY TESTING ===

  const conversationStatusArb = fc.constantFrom<ConversationStatus>(
    'active',
    'reopened',
    'closed',
  );
  const channelArb = fc.constantFrom<Channel>('chat', 'api');
  const titleArb = fc.option(fc.string({ minLength: 1, maxLength: 100 }), {
    nil: undefined,
  });
  const conversationCountArb = fc.integer({ min: 2, max: 10 });
  const turnIndexArb = fc.integer({ min: 0, max: 100 });
  const messageTextArb = fc.string({ minLength: 1, maxLength: 1000 });
  const itemCountArb = fc.integer({ min: 1, max: 10 });

  // === PROPERTY TESTS ===

  describe('Property Tests', () => {
    it('should generate unique IDs for all conversations', async () => {
      const { usersService, conversationsService } = setup();

      // Create a real user first
      const userResult = await usersService.create(createMockContext(), {
        schemaVersion: 1,
      });
      const userId = userResult._unsafeUnwrap().id;

      await fc.assert(
        fc.asyncProperty(
          conversationCountArb,
          channelArb,
          async (count, channel) => {
            const conversationIds = new Set<string>();

            // Create N conversations
            for (let i = 0; i < count; i++) {
              const result = await conversationsService.create(
                createMockContext(),
                userId,
                {
                  schemaVersion: 1,
                  status: 'active',
                  channel,
                },
              );

              expect(result.isOk()).toBe(true);
              const conversation = result._unsafeUnwrap();
              conversationIds.add(conversation.id);
            }

            // All IDs must be unique
            expect(conversationIds.size).toBe(count);
          },
        ),
        { numRuns: 20 },
      );
    });

    it('should maintain CRUD consistency for all operations', async () => {
      const {
        usersService,
        conversationsService,
        conversationsRepo,
        conversationsCache,
      } = setup();

      // Create a real user first
      const userResult = await usersService.create(createMockContext(), {
        schemaVersion: 1,
      });
      const userId = userResult._unsafeUnwrap().id;

      await fc.assert(
        fc.asyncProperty(
          conversationStatusArb,
          channelArb,
          titleArb,
          async (status, channel, title) => {
            // Create conversation
            const createResult = await conversationsService.create(
              createMockContext(),
              userId,
              {
                schemaVersion: 1,
                status,
                channel,
                title,
              },
            );
            expect(createResult.isOk()).toBe(true);
            const created = createResult._unsafeUnwrap();
            expect(created.status).toBe(status);
            expect(created.channel).toBe(channel);
            expect(created.title).toBe(title);

            // Read from service (should hit cache after create)
            const getResult = await conversationsService.get(
              createMockContext(),
              created.id,
              userId,
            );
            expect(getResult.isOk()).toBe(true);
            expect(getResult._unsafeUnwrap()).toEqual(created);

            // Read from cache
            const cacheResult = await conversationsCache.get(
              createMockContext(),
              created.id,
              userId,
            );
            expect(cacheResult.isOk()).toBe(true);
            expect(cacheResult._unsafeUnwrap()).toEqual(created);

            // Read from repo
            const repoResult = await conversationsRepo.get(
              createMockContext(),
              created.id,
              userId,
            );
            expect(repoResult.isOk()).toBe(true);
            expect(repoResult._unsafeUnwrap()).toEqual(created);

            // Update conversation
            const updateResult = await conversationsService.update(
              createMockContext(),
              created.id,
              userId,
              { status, channel, title },
            );
            expect(updateResult.isOk()).toBe(true);
            const updated = updateResult._unsafeUnwrap();
            expect(updated.id).toBe(created.id);
            expect(updated.status).toBe(status);
            expect(updated.channel).toBe(channel);

            // Verify update in cache
            const cacheAfterUpdate = await conversationsCache.get(
              createMockContext(),
              created.id,
              userId,
            );
            expect(cacheAfterUpdate.isOk()).toBe(true);
            expect(cacheAfterUpdate._unsafeUnwrap()).toEqual(updated);

            // Delete conversation
            const deleteResult = await conversationsService.delete(
              createMockContext(),
              created.id,
              userId,
            );
            expect(deleteResult.isOk()).toBe(true);

            // Verify deletion in service
            const getAfterDelete = await conversationsService.get(
              createMockContext(),
              created.id,
              userId,
            );
            expect(getAfterDelete.isErr()).toBe(true);

            // Verify deletion in cache
            const cacheAfterDelete = await conversationsCache.get(
              createMockContext(),
              created.id,
              userId,
            );
            expect(cacheAfterDelete.isErr()).toBe(true);
          },
        ),
        { numRuns: 20 },
      );
    });

    it('should preserve conversation item data through round-trip', async () => {
      const { usersService, conversationsService } = setup();

      // Create a real user first
      const userResult = await usersService.create(createMockContext(), {
        schemaVersion: 1,
      });
      const userId = userResult._unsafeUnwrap().id;

      await fc.assert(
        fc.asyncProperty(
          turnIndexArb,
          messageTextArb,
          async (turnIndex, messageText) => {
            // Create conversation
            const convResult = await conversationsService.create(
              createMockContext(),
              userId,
              {
                schemaVersion: 1,
                status: 'active',
                channel: 'chat',
              },
            );
            const conversation = convResult._unsafeUnwrap();

            // Append item with random data
            const itemData = {
              schemaVersion: 1,
              type: 'message',
              turnIndex,
              message: {
                role: 'user',
                text: messageText,
              },
            } as AppendItemData;

            const appendResult = await conversationsService.appendItem(
              createMockContext(),
              conversation.id,
              userId,
              itemData,
            );
            expect(appendResult.isOk()).toBe(true);

            // Retrieve item and verify data preserved
            const getItemsResult = await conversationsService.getItems(
              createMockContext(),
              conversation.id,
              userId,
            );
            expect(getItemsResult.isOk()).toBe(true);
            const items = getItemsResult._unsafeUnwrap();

            expect(items.length).toBe(1);
            const retrieved = items[0] as MessageItem;
            expect(retrieved.turnIndex).toBe(turnIndex);
            expect(retrieved.message.role).toBe('user');
            expect((retrieved.message as UserMessageBody).text).toBe(
              messageText,
            );
            expect(retrieved.conversationId).toBe(conversation.id);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should cascade delete all items when conversation is deleted', async () => {
      const { usersService, conversationsService, conversationItemsRepo } =
        setup();

      // Create a real user first
      const userResult = await usersService.create(createMockContext(), {
        schemaVersion: 1,
      });
      const userId = userResult._unsafeUnwrap().id;

      await fc.assert(
        fc.asyncProperty(itemCountArb, async (itemCount) => {
          // Create conversation
          const convResult = await conversationsService.create(
            createMockContext(),
            userId,
            {
              schemaVersion: 1,
              status: 'active',
              channel: 'chat',
            },
          );
          const conversation = convResult._unsafeUnwrap();

          // Append N items
          const itemIds: string[] = [];
          for (let i = 0; i < itemCount; i++) {
            const appendResult = await conversationsService.appendItem(
              createMockContext(),
              conversation.id,
              userId,
              {
                schemaVersion: 1,
                type: 'message',
                turnIndex: i,
                message: {
                  role: 'user',
                  text: `Message ${i}`,
                },
              } as AppendItemData,
            );
            expect(appendResult.isOk()).toBe(true);
            itemIds.push(appendResult._unsafeUnwrap().id);
          }

          // Verify items exist
          const itemsBeforeDelete = await conversationsService.getItems(
            createMockContext(),
            conversation.id,
            userId,
          );
          expect(itemsBeforeDelete.isOk()).toBe(true);
          expect(itemsBeforeDelete._unsafeUnwrap().length).toBe(itemCount);

          // Delete conversation
          const deleteResult = await conversationsService.delete(
            createMockContext(),
            conversation.id,
            userId,
          );
          expect(deleteResult.isOk()).toBe(true);

          // Verify all items are cascade deleted
          for (const itemId of itemIds) {
            const itemResult = await conversationItemsRepo.get(
              createMockContext(),
              ConversationItemId(itemId),
              userId,
            );
            expect(itemResult.isErr()).toBe(true);
          }

          // Verify getItems returns empty for deleted conversation
          const itemsAfterDelete = await conversationsService.getItems(
            createMockContext(),
            conversation.id,
            userId,
          );
          // Items should be empty since conversation is deleted
          expect(itemsAfterDelete.isOk()).toBe(true);
          expect(itemsAfterDelete._unsafeUnwrap().length).toBe(0);
        }),
        { numRuns: 20 },
      );
    });

    it('should handle status transitions for all valid statuses', async () => {
      const { usersService, conversationsService } = setup();

      // Create a real user first
      const userResult = await usersService.create(createMockContext(), {
        schemaVersion: 1,
      });
      const userId = userResult._unsafeUnwrap().id;

      await fc.assert(
        fc.asyncProperty(channelArb, async (channel) => {
          // Create active conversation
          const createResult = await conversationsService.create(
            createMockContext(),
            userId,
            {
              schemaVersion: 1,
              status: 'active',
              channel,
            },
          );
          const conversation = createResult._unsafeUnwrap();
          expect(conversation.status).toBe('active');

          // Close conversation
          const closeResult = await conversationsService.close(
            createMockContext(),
            conversation.id,
            userId,
          );
          expect(closeResult.isOk()).toBe(true);
          const closed = closeResult._unsafeUnwrap();
          expect(closed.status).toBe('closed');

          // Reopen conversation
          const reopenResult = await conversationsService.reopen(
            createMockContext(),
            conversation.id,
            userId,
          );
          expect(reopenResult.isOk()).toBe(true);
          const reopened = reopenResult._unsafeUnwrap();
          expect(reopened.status).toBe('reopened');

          // Verify final state persisted
          const finalGet = await conversationsService.get(
            createMockContext(),
            conversation.id,
            userId,
          );
          expect(finalGet.isOk()).toBe(true);
          expect(finalGet._unsafeUnwrap().status).toBe('reopened');
        }),
        { numRuns: 20 },
      );
    });

    it('should update title for any valid string', async () => {
      const { usersService, conversationsService } = setup();

      // Create a real user first
      const userResult = await usersService.create(createMockContext(), {
        schemaVersion: 1,
      });
      const userId = userResult._unsafeUnwrap().id;

      await fc.assert(
        fc.asyncProperty(titleArb, async (title) => {
          // Skip if title is undefined (we want to test actual titles)
          if (title === undefined) {
            return;
          }

          // Create conversation
          const createResult = await conversationsService.create(
            createMockContext(),
            userId,
            {
              schemaVersion: 1,
              status: 'active',
              channel: 'chat',
            },
          );
          const conversation = createResult._unsafeUnwrap();

          // Update title
          const updateResult = await conversationsService.updateTitle(
            createMockContext(),
            conversation.id,
            userId,
            title,
          );
          expect(updateResult.isOk()).toBe(true);
          const updated = updateResult._unsafeUnwrap();
          expect(updated.title).toBe(title);

          // Verify persisted
          const getResult = await conversationsService.get(
            createMockContext(),
            conversation.id,
            userId,
          );
          expect(getResult.isOk()).toBe(true);
          expect(getResult._unsafeUnwrap().title).toBe(title);
        }),
        { numRuns: 30 },
      );
    });

    it('should maintain item order by createdAt', async () => {
      const { usersService, conversationsService } = setup();

      // Create a real user first
      const userResult = await usersService.create(createMockContext(), {
        schemaVersion: 1,
      });
      const userId = userResult._unsafeUnwrap().id;

      await fc.assert(
        fc.asyncProperty(itemCountArb, async (itemCount) => {
          // Create conversation
          const convResult = await conversationsService.create(
            createMockContext(),
            userId,
            {
              schemaVersion: 1,
              status: 'active',
              channel: 'chat',
            },
          );
          const conversation = convResult._unsafeUnwrap();

          // Create items with random turn indices
          const turnIndices: number[] = [];
          for (let i = 0; i < itemCount; i++) {
            const turnIndex = Math.floor(Math.random() * 1000);
            turnIndices.push(turnIndex);

            await conversationsService.appendItem(
              createMockContext(),
              conversation.id,
              userId,
              {
                schemaVersion: 1,
                type: 'message',
                turnIndex,
                message: {
                  role: 'user',
                  text: `Message ${i}`,
                },
              },
            );
          }

          // Get items and verify they're sorted by createdAt
          const getItemsResult = await conversationsService.getItems(
            createMockContext(),
            conversation.id,
            userId,
          );
          expect(getItemsResult.isOk()).toBe(true);
          const items = getItemsResult._unsafeUnwrap();

          expect(items.length).toBe(itemCount);

          // Verify ascending order by createdAt (used in getByConversationId)
          for (let i = 1; i < items.length; i++) {
            expect(
              items[i].createdAt!.getTime() >=
                items[i - 1].createdAt!.getTime(),
            ).toBe(true);
          }
        }),
        { numRuns: 20 },
      );
    });
  });

  // === SPECIFIC BEHAVIOR TESTS ===

  describe('create()', () => {
    it('should create a conversation in database and cache', async () => {
      const {
        usersService,
        conversationsService,
        conversationsRepo,
        conversationsCache,
      } = setup();

      // Create a real user first
      const userResult = await usersService.create(createMockContext(), {
        schemaVersion: 1,
      });
      const userId = userResult._unsafeUnwrap().id;

      const result = await conversationsService.create(
        createMockContext(),
        userId,
        {
          schemaVersion: 1,
          status: 'active',
          channel: 'chat',
          title: 'Test Conversation',
        },
      );

      expect(result.isOk()).toBe(true);
      const conversation = result._unsafeUnwrap();
      expect(conversation.id).toBeDefined();
      expect(conversation.status).toBe('active');
      expect(conversation.channel).toBe('chat');
      expect(conversation.title).toBe('Test Conversation');
      expect(conversation.createdAt).toBeInstanceOf(Date);
      expect(conversation.updatedAt).toBeInstanceOf(Date);

      const cachedResult = await conversationsCache.get(
        createMockContext(),
        conversation.id,
        userId,
      );
      expect(cachedResult.isOk()).toBe(true);
      expect(cachedResult._unsafeUnwrap()).toEqual(conversation);

      const repoResult = await conversationsRepo.get(
        createMockContext(),
        conversation.id,
        userId,
      );
      expect(repoResult.isOk()).toBe(true);
      expect(repoResult._unsafeUnwrap()).toEqual(conversation);
    });
  });

  describe('getWithItems()', () => {
    it('should return conversation with all items', async () => {
      const { usersService, conversationsService } = setup();

      // Create a real user first
      const userResult = await usersService.create(createMockContext(), {
        schemaVersion: 1,
      });
      const userId = userResult._unsafeUnwrap().id;

      // Create conversation
      const convResult = await conversationsService.create(
        createMockContext(),
        userId,
        {
          schemaVersion: 1,
          status: 'active',
          channel: 'chat',
          title: 'Test',
        },
      );
      const conversation = convResult._unsafeUnwrap();

      // Add items
      await conversationsService.appendItem(
        createMockContext(),
        conversation.id,
        userId,
        {
          schemaVersion: 1,
          type: 'message',
          turnIndex: 0,
          message: {
            role: 'user',
            text: 'Hello',
          },
        },
      );

      await conversationsService.appendItem(
        createMockContext(),
        conversation.id,
        userId,
        {
          schemaVersion: 1,
          type: 'message',
          turnIndex: 1,
          message: {
            role: 'user',
            text: 'World',
          },
        },
      );

      // Get with items
      const result = await conversationsService.getWithItems(
        createMockContext(),
        conversation.id,
        userId,
      );

      expect(result.isOk()).toBe(true);
      const withItems = result._unsafeUnwrap();
      expect(withItems.id).toBe(conversation.id);
      expect(withItems.items.length).toBe(2);
      expect((withItems.items[0] as MessageItem).message.role).toBe('user');
      expect((withItems.items[1] as MessageItem).message.role).toBe('user');
    });
  });

  describe('all()', () => {
    it('should return all conversations for user', async () => {
      const { usersService, conversationsService } = setup();

      // Create a real user first
      const userResult = await usersService.create(createMockContext(), {
        schemaVersion: 1,
      });
      const userId = userResult._unsafeUnwrap().id;

      await conversationsService.create(createMockContext(), userId, {
        schemaVersion: 1,
        status: 'active',
        channel: 'chat',
      });
      await conversationsService.create(createMockContext(), userId, {
        schemaVersion: 1,
        status: 'active',
        channel: 'api',
      });
      await conversationsService.create(createMockContext(), userId, {
        schemaVersion: 1,
        status: 'closed',
        channel: 'chat',
      });

      const allResult = await conversationsService.all(
        createMockContext(),
        userId,
      );

      expect(allResult.isOk()).toBe(true);
      const conversations = allResult._unsafeUnwrap();
      expect(conversations.length).toBe(3);
    });

    it('should return empty array when no conversations exist', async () => {
      const { usersService, conversationsService } = setup();

      // Create a real user first
      const userResult = await usersService.create(createMockContext(), {
        schemaVersion: 1,
      });
      const userId = userResult._unsafeUnwrap().id;

      const allResult = await conversationsService.all(
        createMockContext(),
        userId,
      );

      expect(allResult.isOk()).toBe(true);
      const conversations = allResult._unsafeUnwrap();
      expect(conversations.length).toBe(0);
    });
  });
});
