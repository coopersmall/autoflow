/**
 * SecretsService Integration Tests
 *
 * Tests complete secrets management flows with real:
 * - Encryption/decryption round-trips
 * - User isolation (security properties)
 * - Unicode and special character handling
 * - Cache and database synchronization
 * - CRUD operations
 *
 * Uses property-based testing for core invariants, with specific unit tests
 * only for functionality that doesn't fit the property model.
 */

import { describe, expect, it } from 'bun:test';
import { createMockContext } from '@backend/infrastructure/context/__mocks__/Context.mock';
import { createSecretsService } from '@backend/secrets';
import { createSecretsCache } from '@backend/secrets/cache/SecretsCache';
import { createSecretsRepo } from '@backend/secrets/repos/SecretsRepo';
import { setupIntegrationTest } from '@backend/testing/integration/integrationTest';
import { createUsersService } from '@backend/users';
import { SecretId, type SecretWithValue } from '@core/domain/secrets/Secret';
import * as fc from 'fast-check';

describe('SecretsService Integration Tests', () => {
  const { getConfig, getLogger } = setupIntegrationTest();

  const setup = async () => {
    const config = getConfig();
    const logger = getLogger();

    const usersService = createUsersService({
      appConfig: config,
      logger,
    });

    const userResult = await usersService.create(createMockContext(), {
      schemaVersion: 1,
    });

    const user = userResult._unsafeUnwrap();

    const secretsService = createSecretsService({
      appConfig: config,
      logger,
    });

    const secretsRepo = createSecretsRepo({ appConfig: config });
    const secretsCache = createSecretsCache({
      appConfig: config,
      logger,
    });

    return {
      secretsService,
      secretsRepo,
      secretsCache,
      userId: user.id,
    };
  };

  describe('Property Tests', () => {
    // Arbitraries for property-based testing
    const stringValueArb = fc.string({ minLength: 0, maxLength: 10000 });
    const unicodeValueArb = fc.string({ minLength: 1, maxLength: 1000 });
    const secretNameArb = fc.string({ minLength: 1, maxLength: 255 });

    it('should encrypt and decrypt any string value correctly', async () => {
      const { secretsService, userId } = await setup();

      await fc.assert(
        fc.asyncProperty(stringValueArb, secretNameArb, async (value, name) => {
          const ctx = createMockContext();

          // Store with encryption
          const storeResult = await secretsService.store(ctx, {
            userId,
            value,
            data: {
              type: 'stored' as const,
              schemaVersion: 1 as const,
              name,
              metadata: {},
            },
          });

          expect(storeResult.isOk()).toBe(true);
          const secret = storeResult._unsafeUnwrap();

          // Value should be encrypted (not plain text unless empty)
          if (value.length > 0) {
            expect(secret.encryptedValue).not.toBe(value);
          }
          expect(secret.salt).toBeDefined();

          // Reveal should decrypt back to original value
          const revealResult = await secretsService.reveal(ctx, {
            userId,
            id: secret.id,
          });

          expect(revealResult.isOk()).toBe(true);
          const revealed = revealResult._unsafeUnwrap() as SecretWithValue;
          expect(revealed.value).toBe(value);
        }),
        { numRuns: 50 },
      );
    });

    it('should handle unicode and special characters correctly', async () => {
      const { secretsService, userId } = await setup();

      await fc.assert(
        fc.asyncProperty(unicodeValueArb, async (unicodeValue) => {
          const ctx = createMockContext();

          const storeResult = await secretsService.store(ctx, {
            userId,
            value: unicodeValue,
            data: {
              type: 'stored' as const,
              schemaVersion: 1 as const,
              name: 'Unicode Test',
              metadata: {},
            },
          });

          expect(storeResult.isOk()).toBe(true);
          const secret = storeResult._unsafeUnwrap();

          const revealResult = await secretsService.reveal(ctx, {
            userId,
            id: secret.id,
          });

          expect(revealResult.isOk()).toBe(true);
          const revealed = revealResult._unsafeUnwrap() as SecretWithValue;
          expect(revealed.value).toBe(unicodeValue);
        }),
        { numRuns: 50 },
      );
    });

    it('should produce unique ciphertext for same plaintext (salt uniqueness)', async () => {
      const { secretsService, userId } = await setup();

      await fc.assert(
        fc.asyncProperty(
          stringValueArb.filter((s) => s.length > 0),
          async (value) => {
            const ctx = createMockContext();

            // Store same value twice
            const store1 = await secretsService.store(ctx, {
              userId,
              value,
              data: {
                type: 'stored' as const,
                schemaVersion: 1 as const,
                name: 'Secret 1',
                metadata: {},
              },
            });

            const store2 = await secretsService.store(ctx, {
              userId,
              value,
              data: {
                type: 'stored' as const,
                schemaVersion: 1 as const,
                name: 'Secret 2',
                metadata: {},
              },
            });

            expect(store1.isOk()).toBe(true);
            expect(store2.isOk()).toBe(true);

            const secret1 = store1._unsafeUnwrap();
            const secret2 = store2._unsafeUnwrap();

            // Security property: same plaintext should produce different ciphertext
            expect(secret1.salt).not.toBe(secret2.salt);
            expect(secret1.encryptedValue).not.toBe(secret2.encryptedValue);
            expect(secret1.id).not.toBe(secret2.id);

            // But both should decrypt to same value
            const reveal1 = await secretsService.reveal(ctx, {
              userId,
              id: secret1.id,
            });
            const reveal2 = await secretsService.reveal(ctx, {
              userId,
              id: secret2.id,
            });

            const value1 = (reveal1._unsafeUnwrap() as SecretWithValue).value;
            const value2 = (reveal2._unsafeUnwrap() as SecretWithValue).value;

            expect(value1).toBe(value);
            expect(value2).toBe(value);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should never allow cross-user secret access', async () => {
      const config = getConfig();
      const logger = getLogger();
      const usersService = createUsersService({ appConfig: config, logger });
      const secretsService = createSecretsService({
        appConfig: config,
        logger,
      });

      await fc.assert(
        fc.asyncProperty(stringValueArb, secretNameArb, async (value, name) => {
          const ctx = createMockContext();

          // Create two users
          const user1Result = await usersService.create(ctx, {
            schemaVersion: 1,
          });
          const user2Result = await usersService.create(ctx, {
            schemaVersion: 1,
          });

          const user1Id = user1Result._unsafeUnwrap().id;
          const user2Id = user2Result._unsafeUnwrap().id;

          // User 1 stores a secret
          const storeResult = await secretsService.store(ctx, {
            userId: user1Id,
            value,
            data: {
              type: 'stored' as const,
              schemaVersion: 1 as const,
              name,
              metadata: {},
            },
          });

          expect(storeResult.isOk()).toBe(true);
          const secret = storeResult._unsafeUnwrap();

          // User 2 should NOT be able to access it
          const user2GetResult = await secretsService.get(
            ctx,
            secret.id,
            user2Id,
          );
          expect(user2GetResult.isErr()).toBe(true);

          const user2RevealResult = await secretsService.reveal(ctx, {
            userId: user2Id,
            id: secret.id,
          });
          expect(user2RevealResult.isErr()).toBe(true);

          // User 1 should be able to access it
          const user1GetResult = await secretsService.get(
            ctx,
            secret.id,
            user1Id,
          );
          expect(user1GetResult.isOk()).toBe(true);

          const user1RevealResult = await secretsService.reveal(ctx, {
            userId: user1Id,
            id: secret.id,
          });
          expect(user1RevealResult.isOk()).toBe(true);
        }),
        { numRuns: 20 },
      );
    });

    it('should preserve secret names exactly through all operations', async () => {
      const { secretsService, userId } = await setup();

      await fc.assert(
        fc.asyncProperty(stringValueArb, secretNameArb, async (value, name) => {
          const ctx = createMockContext();

          const storeResult = await secretsService.store(ctx, {
            userId,
            value,
            data: {
              type: 'stored' as const,
              schemaVersion: 1 as const,
              name,
              metadata: {},
            },
          });

          expect(storeResult.isOk()).toBe(true);
          const secret = storeResult._unsafeUnwrap();
          expect(secret.name).toBe(name);

          // Get should preserve name
          const getResult = await secretsService.get(ctx, secret.id, userId);
          expect(getResult.isOk()).toBe(true);
          expect(getResult._unsafeUnwrap().name).toBe(name);

          // Reveal should preserve name
          const revealResult = await secretsService.reveal(ctx, {
            userId,
            id: secret.id,
          });
          expect(revealResult.isOk()).toBe(true);
          expect((revealResult._unsafeUnwrap() as SecretWithValue).name).toBe(
            name,
          );
        }),
        { numRuns: 50 },
      );
    });
  });

  describe('CRUD operations', () => {
    it('should store secret in database and cache', async () => {
      const { secretsService, secretsRepo, secretsCache, userId } =
        await setup();

      const storeRequest = {
        userId,
        value: 'my-secret-password-123',
        data: {
          type: 'stored' as const,
          schemaVersion: 1 as const,
          name: 'Test Secret',
          metadata: {
            createdBy: userId,
          },
        },
      };

      const result = await secretsService.store(
        createMockContext(),
        storeRequest,
      );

      expect(result.isOk()).toBe(true);
      const secret = result._unsafeUnwrap();
      expect(secret.id).toBeDefined();
      expect(secret.name).toBe('Test Secret');
      expect(secret.createdAt).toBeInstanceOf(Date);
      expect(secret.updatedAt).toBeInstanceOf(Date);

      // Verify cache has it
      const cachedResult = await secretsCache.get(
        createMockContext(),
        secret.id,
        userId,
      );
      expect(cachedResult.isOk()).toBe(true);

      // Verify database has it
      const repoResult = await secretsRepo.get(
        createMockContext(),
        secret.id,
        userId,
      );
      expect(repoResult.isOk()).toBe(true);
    });

    it('should update secret metadata and refresh cache', async () => {
      const { secretsService, secretsCache, secretsRepo, userId } =
        await setup();

      const storeResult = await secretsService.store(createMockContext(), {
        userId,
        value: 'original-value',
        data: {
          type: 'stored' as const,
          schemaVersion: 1 as const,
          name: 'Original Name',
          metadata: {},
        },
      });

      const secret = storeResult._unsafeUnwrap();

      const updateResult = await secretsService.update(
        createMockContext(),
        secret.id,
        userId,
        {
          name: 'Updated Name',
        },
      );

      expect(updateResult.isOk()).toBe(true);
      const updatedSecret = updateResult._unsafeUnwrap();
      expect(updatedSecret.name).toBe('Updated Name');
      expect(updatedSecret.id).toBe(secret.id);

      // Verify cache was updated
      const cacheAfter = await secretsCache.get(
        createMockContext(),
        secret.id,
        userId,
      );
      expect(cacheAfter.isOk()).toBe(true);
      expect(cacheAfter._unsafeUnwrap().name).toBe('Updated Name');

      // Verify database was updated
      const repoResult = await secretsRepo.get(
        createMockContext(),
        secret.id,
        userId,
      );
      expect(repoResult.isOk()).toBe(true);
      expect(repoResult._unsafeUnwrap().name).toBe('Updated Name');
    });

    it('should delete secret from database and cache', async () => {
      const { secretsService, secretsCache, secretsRepo, userId } =
        await setup();

      const storeResult = await secretsService.store(createMockContext(), {
        userId,
        value: 'to-be-deleted',
        data: {
          type: 'stored' as const,
          schemaVersion: 1 as const,
          name: 'Delete Me',
          metadata: {},
        },
      });

      const secret = storeResult._unsafeUnwrap();

      const deleteResult = await secretsService.delete(
        createMockContext(),
        secret.id,
        userId,
      );
      expect(deleteResult.isOk()).toBe(true);

      // Verify removed from service
      const getResult = await secretsService.get(
        createMockContext(),
        secret.id,
        userId,
      );
      expect(getResult.isErr()).toBe(true);

      // Verify removed from cache
      const cacheAfter = await secretsCache.get(
        createMockContext(),
        secret.id,
        userId,
      );
      expect(cacheAfter.isErr()).toBe(true);

      // Verify removed from database
      const repoResult = await secretsRepo.get(
        createMockContext(),
        secret.id,
        userId,
      );
      expect(repoResult.isErr()).toBe(true);
    });

    it('should return all secrets for a user', async () => {
      const { secretsService, userId } = await setup();

      await secretsService.store(createMockContext(), {
        userId,
        value: 'secret-1',
        data: {
          type: 'stored' as const,
          schemaVersion: 1 as const,
          name: 'Secret 1',
          metadata: {},
        },
      });

      await secretsService.store(createMockContext(), {
        userId,
        value: 'secret-2',
        data: {
          type: 'stored' as const,
          schemaVersion: 1 as const,
          name: 'Secret 2',
          metadata: {},
        },
      });

      const allResult = await secretsService.all(createMockContext(), userId);

      expect(allResult.isOk()).toBe(true);
      const secrets = allResult._unsafeUnwrap();
      expect(secrets.length).toBe(2);

      secrets.forEach((secret) => {
        expect(secret.encryptedValue).toBeDefined();
        expect('value' in secret).toBe(false);
      });
    });

    it('should return empty array when no secrets exist', async () => {
      const { secretsService, userId } = await setup();

      const allResult = await secretsService.all(createMockContext(), userId);

      expect(allResult.isOk()).toBe(true);
      const secrets = allResult._unsafeUnwrap();
      expect(secrets.length).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should return error when revealing non-existent secret', async () => {
      const { secretsService, userId } = await setup();

      const fakeSecretId = SecretId('non-existent-secret-id');

      const revealResult = await secretsService.reveal(createMockContext(), {
        userId,
        id: fakeSecretId,
      });

      expect(revealResult.isErr()).toBe(true);
    });
  });

  describe('cache behavior', () => {
    it('should use cache on second retrieval', async () => {
      const { secretsService, secretsCache, userId } = await setup();

      const storeResult = await secretsService.store(createMockContext(), {
        userId,
        value: 'cached-secret',
        data: {
          type: 'stored' as const,
          schemaVersion: 1 as const,
          name: 'Cache Test',
          metadata: {},
        },
      });

      const secret = storeResult._unsafeUnwrap();

      const firstGet = await secretsService.get(
        createMockContext(),
        secret.id,
        userId,
      );
      expect(firstGet.isOk()).toBe(true);

      const secondGet = await secretsService.get(
        createMockContext(),
        secret.id,
        userId,
      );
      expect(secondGet.isOk()).toBe(true);

      expect(firstGet._unsafeUnwrap()).toEqual(secondGet._unsafeUnwrap());

      const cacheResult = await secretsCache.get(
        createMockContext(),
        secret.id,
        userId,
      );
      expect(cacheResult.isOk()).toBe(true);
    });
  });
});
