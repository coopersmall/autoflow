import { describe, expect, it } from 'bun:test';
import { createMockContext } from '@backend/infrastructure/context/__mocks__/Context.mock';
import { setupIntegrationTest } from '@backend/testing/integration/integrationTest';
import { createUsersService } from '@backend/users';
import { createUsersCache } from '@backend/users/cache/UsersCache';
import { createUsersRepo } from '@backend/users/repos/UsersRepo';
import * as fc from 'fast-check';

describe('UsersService Integration Tests', () => {
  const { getConfig, getLogger } = setupIntegrationTest();

  const setup = () => {
    const config = getConfig();
    const logger = getLogger();

    const usersService = createUsersService({
      appConfig: config,
      logger,
    });

    const usersRepo = createUsersRepo({ appConfig: config });
    const usersCache = createUsersCache({
      appConfig: config,
      logger,
    });

    return {
      usersService,
      usersRepo,
      usersCache,
    };
  };

  describe('Property Tests', () => {
    // Arbitraries for property-based testing
    const userCountArb = fc.integer({ min: 2, max: 10 });
    const schemaVersionArb = fc.constantFrom(1);

    it('should generate unique IDs for all users', async () => {
      const { usersService } = setup();

      await fc.assert(
        fc.asyncProperty(userCountArb, async (count) => {
          const userIds = new Set<string>();

          // Create N users
          for (let i = 0; i < count; i++) {
            const result = await usersService.create(createMockContext(), {
              schemaVersion: 1,
            });

            expect(result.isOk()).toBe(true);
            const user = result._unsafeUnwrap();
            userIds.add(user.id);
          }

          // All IDs must be unique
          expect(userIds.size).toBe(count);
        }),
        { numRuns: 20 },
      );
    });

    it('should maintain CRUD consistency for all operations', async () => {
      const { usersService, usersRepo, usersCache } = setup();

      await fc.assert(
        fc.asyncProperty(schemaVersionArb, async (schemaVersion) => {
          // Create user
          const createResult = await usersService.create(createMockContext(), {
            schemaVersion,
          });
          expect(createResult.isOk()).toBe(true);
          const createdUser = createResult._unsafeUnwrap();
          expect(createdUser.schemaVersion).toBe(schemaVersion);

          // Read from service (should hit cache after create)
          const getResult = await usersService.get(
            createMockContext(),
            createdUser.id,
          );
          expect(getResult.isOk()).toBe(true);
          expect(getResult._unsafeUnwrap()).toEqual(createdUser);

          // Read from cache
          const cacheResult = await usersCache.get(
            createMockContext(),
            createdUser.id,
          );
          expect(cacheResult.isOk()).toBe(true);
          expect(cacheResult._unsafeUnwrap()).toEqual(createdUser);

          // Read from repo
          const repoResult = await usersRepo.get(
            createMockContext(),
            createdUser.id,
          );
          expect(repoResult.isOk()).toBe(true);
          expect(repoResult._unsafeUnwrap()).toEqual(createdUser);

          // Update user
          const updateResult = await usersService.update(
            createMockContext(),
            createdUser.id,
            { schemaVersion },
          );
          expect(updateResult.isOk()).toBe(true);
          const updatedUser = updateResult._unsafeUnwrap();
          expect(updatedUser.id).toBe(createdUser.id);
          expect(updatedUser.schemaVersion).toBe(schemaVersion);

          // Verify update in cache
          const cacheAfterUpdate = await usersCache.get(
            createMockContext(),
            createdUser.id,
          );
          expect(cacheAfterUpdate.isOk()).toBe(true);
          expect(cacheAfterUpdate._unsafeUnwrap()).toEqual(updatedUser);

          // Delete user
          const deleteResult = await usersService.delete(
            createMockContext(),
            createdUser.id,
          );
          expect(deleteResult.isOk()).toBe(true);

          // Verify deletion in service
          const getAfterDelete = await usersService.get(
            createMockContext(),
            createdUser.id,
          );
          expect(getAfterDelete.isErr()).toBe(true);

          // Verify deletion in cache
          const cacheAfterDelete = await usersCache.get(
            createMockContext(),
            createdUser.id,
          );
          expect(cacheAfterDelete.isErr()).toBe(true);

          // Verify deletion in repo
          const repoAfterDelete = await usersRepo.get(
            createMockContext(),
            createdUser.id,
          );
          expect(repoAfterDelete.isErr()).toBe(true);
        }),
        { numRuns: 20 },
      );
    });
  });

  describe('create()', () => {
    it('should create a user in database and cache', async () => {
      const { usersService, usersRepo, usersCache } = setup();

      const userData = {
        schemaVersion: 1 as const,
      };

      const result = await usersService.create(createMockContext(), userData);

      expect(result.isOk()).toBe(true);
      const user = result._unsafeUnwrap();
      expect(user.id).toBeDefined();
      expect(user.schemaVersion).toBe(1);
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);

      const cachedResult = await usersCache.get(createMockContext(), user.id);
      expect(cachedResult.isOk()).toBe(true);
      expect(cachedResult._unsafeUnwrap()).toEqual(user);

      const repoResult = await usersRepo.get(createMockContext(), user.id);
      expect(repoResult.isOk()).toBe(true);
      expect(repoResult._unsafeUnwrap()).toEqual(user);
    });

    it('should create multiple users with unique IDs', async () => {
      const { usersService, usersCache, usersRepo } = setup();

      const user1Result = await usersService.create(createMockContext(), {
        schemaVersion: 1,
      });
      const user2Result = await usersService.create(createMockContext(), {
        schemaVersion: 1,
      });

      expect(user1Result.isOk()).toBe(true);
      expect(user2Result.isOk()).toBe(true);

      const user1 = user1Result._unsafeUnwrap();
      const user2 = user2Result._unsafeUnwrap();

      expect(user1.id).not.toBe(user2.id);

      const cacheResult1 = await usersCache.get(createMockContext(), user1.id);
      expect(cacheResult1.isOk()).toBe(true);
      expect(cacheResult1._unsafeUnwrap()).toEqual(user1);

      const cacheResult2 = await usersCache.get(createMockContext(), user2.id);
      expect(cacheResult2.isOk()).toBe(true);
      expect(cacheResult2._unsafeUnwrap()).toEqual(user2);

      const repoResult1 = await usersRepo.get(createMockContext(), user1.id);
      expect(repoResult1.isOk()).toBe(true);
      expect(repoResult1._unsafeUnwrap()).toEqual(user1);

      const repoResult2 = await usersRepo.get(createMockContext(), user2.id);
      expect(repoResult2.isOk()).toBe(true);
      expect(repoResult2._unsafeUnwrap()).toEqual(user2);
    });
  });

  describe('get()', () => {
    it('should retrieve user from database', async () => {
      const { usersService, usersCache, usersRepo } = setup();

      const createResult = await usersService.create(createMockContext(), {
        schemaVersion: 1,
      });
      expect(createResult.isOk()).toBe(true);
      const createdUser = createResult._unsafeUnwrap();

      const getResult = await usersService.get(
        createMockContext(),
        createdUser.id,
      );

      expect(getResult.isOk()).toBe(true);
      const retrievedUser = getResult._unsafeUnwrap();
      expect(retrievedUser.id).toBe(createdUser.id);
      expect(retrievedUser.schemaVersion).toBe(1);

      const cacheResult = await usersCache.get(
        createMockContext(),
        createdUser.id,
      );
      expect(cacheResult.isOk()).toBe(true);
      expect(cacheResult._unsafeUnwrap()).toEqual(retrievedUser);

      const repoResult = await usersRepo.get(
        createMockContext(),
        createdUser.id,
      );
      expect(repoResult.isOk()).toBe(true);
      expect(repoResult._unsafeUnwrap()).toEqual(retrievedUser);
    });

    it('should use cache on second retrieval', async () => {
      const { usersService, usersCache } = setup();

      const createResult = await usersService.create(createMockContext(), {
        schemaVersion: 1,
      });
      const user = createResult._unsafeUnwrap();

      const firstGet = await usersService.get(createMockContext(), user.id);
      expect(firstGet.isOk()).toBe(true);

      const secondGet = await usersService.get(createMockContext(), user.id);
      expect(secondGet.isOk()).toBe(true);

      expect(firstGet._unsafeUnwrap()).toEqual(secondGet._unsafeUnwrap());

      const cacheResult = await usersCache.get(createMockContext(), user.id);
      expect(cacheResult.isOk()).toBe(true);
      expect(cacheResult._unsafeUnwrap()).toEqual(user);
    });
  });

  describe('update()', () => {
    it('should update user in database and invalidate cache', async () => {
      const { usersService, usersCache, usersRepo } = setup();

      const createResult = await usersService.create(createMockContext(), {
        schemaVersion: 1,
      });
      const user = createResult._unsafeUnwrap();

      const cacheResultBefore = await usersCache.get(
        createMockContext(),
        user.id,
      );
      expect(cacheResultBefore.isOk()).toBe(true);
      expect(cacheResultBefore._unsafeUnwrap()).toEqual(user);

      const updateData = {
        schemaVersion: 1 as const,
      };
      const updateResult = await usersService.update(
        createMockContext(),
        user.id,
        updateData,
      );

      expect(updateResult.isOk()).toBe(true);
      const updatedUser = updateResult._unsafeUnwrap();
      expect(updatedUser.id).toBe(user.id);
      expect(updatedUser.updatedAt?.getTime()).toBeGreaterThanOrEqual(
        user.updatedAt?.getTime() || 0,
      );

      const cacheResultAfter = await usersCache.get(
        createMockContext(),
        user.id,
      );
      expect(cacheResultAfter.isOk()).toBe(true);
      expect(cacheResultAfter._unsafeUnwrap()).toEqual(updatedUser);

      const repoResult = await usersRepo.get(createMockContext(), user.id);
      expect(repoResult.isOk()).toBe(true);
      expect(repoResult._unsafeUnwrap()).toEqual(updatedUser);
    });
  });

  describe('delete()', () => {
    it('should delete user from database and cache', async () => {
      const { usersService, usersCache, usersRepo } = setup();

      const createResult = await usersService.create(createMockContext(), {
        schemaVersion: 1,
      });
      const user = createResult._unsafeUnwrap();

      const deleteResult = await usersService.delete(
        createMockContext(),
        user.id,
      );
      expect(deleteResult.isOk()).toBe(true);

      const getResult = await usersService.get(createMockContext(), user.id);
      expect(getResult.isErr()).toBe(true);

      const cacheResult = await usersCache.get(createMockContext(), user.id);
      expect(cacheResult.isErr()).toBe(true);

      const repoResult = await usersRepo.get(createMockContext(), user.id);
      expect(repoResult.isErr()).toBe(true);
    });
  });

  describe('all()', () => {
    it('should return all users from database', async () => {
      const { usersService, usersRepo } = setup();

      await usersService.create(createMockContext(), { schemaVersion: 1 });
      await usersService.create(createMockContext(), { schemaVersion: 1 });
      await usersService.create(createMockContext(), { schemaVersion: 1 });

      const allResult = await usersService.all(createMockContext());

      expect(allResult.isOk()).toBe(true);
      const users = allResult._unsafeUnwrap();
      expect(users.length).toBe(3);

      const repoAllResult = await usersRepo.all(createMockContext());
      expect(repoAllResult.isOk()).toBe(true);
      const repoUsers = repoAllResult._unsafeUnwrap();
      expect(repoUsers.length).toBe(3);
    });

    it('should return empty array when no users exist', async () => {
      const { usersService, usersRepo } = setup();

      const allResult = await usersService.all(createMockContext());

      expect(allResult.isOk()).toBe(true);
      const users = allResult._unsafeUnwrap();
      expect(users.length).toBe(0);

      const repoAllResult = await usersRepo.all(createMockContext());
      expect(repoAllResult.isOk()).toBe(true);
      const repoUsers = repoAllResult._unsafeUnwrap();
      expect(repoUsers.length).toBe(0);
    });
  });
});
