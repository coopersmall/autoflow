import { describe, expect, it } from 'bun:test';
import { createSecretsService } from '@backend/secrets';
import { createSecretsCache } from '@backend/secrets/cache/SecretsCache';
import { createSecretsRepo } from '@backend/secrets/repos/SecretsRepo';
import { setupIntegrationTest } from '@backend/testing/integration/integrationTest';
import { createUsersService } from '@backend/users';
import { CorrelationId } from '@core/domain/CorrelationId';
import { SecretId, type SecretWithValue } from '@core/domain/secrets/Secret';

describe('SecretsService Integration Tests', () => {
  const { getConfig, getLogger } = setupIntegrationTest();

  const setup = async () => {
    const config = getConfig();
    const logger = getLogger();

    const usersService = createUsersService({
      appConfig: config,
      logger,
    });
    const userResult = await usersService.create({ schemaVersion: 1 });
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

  describe('store()', () => {
    it('should store an encrypted secret in database and cache', async () => {
      const { secretsService, secretsRepo, secretsCache, userId } =
        await setup();

      const storeRequest = {
        correlationId: CorrelationId(),
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

      const result = await secretsService.store(storeRequest);

      expect(result.isOk()).toBe(true);
      const secret = result._unsafeUnwrap();
      expect(secret.id).toBeDefined();
      expect(secret.name).toBe('Test Secret');
      expect(secret.type).toBe('stored');
      expect(secret.salt).toBeDefined();
      expect(secret.encryptedValue).toBeDefined();
      expect(secret.encryptedValue).not.toBe('my-secret-password-123');
      expect(secret.createdAt).toBeInstanceOf(Date);
      expect(secret.updatedAt).toBeInstanceOf(Date);

      const cachedResult = await secretsCache.get(secret.id, userId);
      expect(cachedResult.isOk()).toBe(true);
      expect(cachedResult._unsafeUnwrap()).toEqual(secret);

      const repoResult = await secretsRepo.get(secret.id, userId);
      expect(repoResult.isOk()).toBe(true);
      expect(repoResult._unsafeUnwrap()).toEqual(secret);
    });

    it('should store multiple secrets with unique IDs and encryption', async () => {
      const { secretsService, secretsCache, secretsRepo, userId } =
        await setup();

      const secret1Result = await secretsService.store({
        correlationId: CorrelationId(),
        userId,
        value: 'password-one',
        data: {
          type: 'stored' as const,
          schemaVersion: 1 as const,
          name: 'Secret One',
          metadata: {},
        },
      });

      const secret2Result = await secretsService.store({
        correlationId: CorrelationId(),
        userId,
        value: 'password-two',
        data: {
          type: 'stored' as const,
          schemaVersion: 1 as const,
          name: 'Secret Two',
          metadata: {},
        },
      });

      expect(secret1Result.isOk()).toBe(true);
      expect(secret2Result.isOk()).toBe(true);

      const secret1 = secret1Result._unsafeUnwrap();
      const secret2 = secret2Result._unsafeUnwrap();

      expect(secret1.id).not.toBe(secret2.id);

      expect(secret1.encryptedValue).not.toBe(secret2.encryptedValue);
      expect(secret1.salt).not.toBe(secret2.salt);

      const cache1 = await secretsCache.get(secret1.id, userId);
      const cache2 = await secretsCache.get(secret2.id, userId);
      expect(cache1.isOk()).toBe(true);
      expect(cache2.isOk()).toBe(true);

      const repo1 = await secretsRepo.get(secret1.id, userId);
      const repo2 = await secretsRepo.get(secret2.id, userId);
      expect(repo1.isOk()).toBe(true);
      expect(repo2.isOk()).toBe(true);
    });
  });

  describe('reveal()', () => {
    it('should decrypt and reveal stored secret', async () => {
      const { secretsService, userId } = await setup();

      const plainTextValue = 'super-secret-value-456';

      const storeResult = await secretsService.store({
        correlationId: CorrelationId(),
        userId,
        value: plainTextValue,
        data: {
          type: 'stored' as const,
          schemaVersion: 1 as const,
          name: 'Secret to Reveal',
          metadata: {},
        },
      });

      expect(storeResult.isOk()).toBe(true);
      const storedSecret = storeResult._unsafeUnwrap();

      const revealResult = await secretsService.reveal({
        correlationId: CorrelationId(),
        userId,
        id: storedSecret.id,
      });

      expect(revealResult.isOk()).toBe(true);
      const revealedSecret = revealResult._unsafeUnwrap() as SecretWithValue;

      expect(revealedSecret.value).toBe(plainTextValue);
      expect(revealedSecret.id).toBe(storedSecret.id);
      expect(revealedSecret.name).toBe('Secret to Reveal');
      expect(revealedSecret.encryptedValue).toBe(storedSecret.encryptedValue);
    });

    it('should return error when revealing non-existent secret', async () => {
      const { secretsService, userId } = await setup();

      const fakeSecretId = SecretId('non-existent-secret-id');

      const revealResult = await secretsService.reveal({
        correlationId: CorrelationId(),
        userId,
        id: fakeSecretId,
      });

      expect(revealResult.isErr()).toBe(true);
    });
  });

  describe('get()', () => {
    it('should retrieve secret metadata without decrypting', async () => {
      const { secretsService, secretsCache, secretsRepo, userId } =
        await setup();

      const storeResult = await secretsService.store({
        correlationId: CorrelationId(),
        userId,
        value: 'secret-password',
        data: {
          type: 'stored' as const,
          schemaVersion: 1 as const,
          name: 'Metadata Test',
          metadata: {
            createdBy: userId,
          },
        },
      });

      const storedSecret = storeResult._unsafeUnwrap();

      const getResult = await secretsService.get(storedSecret.id, userId);

      expect(getResult.isOk()).toBe(true);
      const retrievedSecret = getResult._unsafeUnwrap();
      expect(retrievedSecret.id).toBe(storedSecret.id);
      expect(retrievedSecret.name).toBe('Metadata Test');
      expect(retrievedSecret.encryptedValue).toBe(storedSecret.encryptedValue);
      expect('value' in retrievedSecret).toBe(false);

      const cacheResult = await secretsCache.get(storedSecret.id, userId);
      expect(cacheResult.isOk()).toBe(true);

      const repoResult = await secretsRepo.get(storedSecret.id, userId);
      expect(repoResult.isOk()).toBe(true);
    });

    it('should use cache on second retrieval', async () => {
      const { secretsService, secretsCache, userId } = await setup();

      const storeResult = await secretsService.store({
        correlationId: CorrelationId(),
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

      const firstGet = await secretsService.get(secret.id, userId);
      expect(firstGet.isOk()).toBe(true);

      const secondGet = await secretsService.get(secret.id, userId);
      expect(secondGet.isOk()).toBe(true);

      expect(firstGet._unsafeUnwrap()).toEqual(secondGet._unsafeUnwrap());

      const cacheResult = await secretsCache.get(secret.id, userId);
      expect(cacheResult.isOk()).toBe(true);
    });
  });

  describe('update()', () => {
    it('should update secret metadata and refresh cache', async () => {
      const { secretsService, secretsCache, secretsRepo, userId } =
        await setup();

      const storeResult = await secretsService.store({
        correlationId: CorrelationId(),
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

      const cacheBefore = await secretsCache.get(secret.id, userId);
      expect(cacheBefore.isOk()).toBe(true);
      expect(cacheBefore._unsafeUnwrap().name).toBe('Original Name');

      const updateResult = await secretsService.update(secret.id, userId, {
        name: 'Updated Name',
      });

      expect(updateResult.isOk()).toBe(true);
      const updatedSecret = updateResult._unsafeUnwrap();
      expect(updatedSecret.name).toBe('Updated Name');
      expect(updatedSecret.id).toBe(secret.id);
      expect(updatedSecret.updatedAt?.getTime()).toBeGreaterThanOrEqual(
        secret.updatedAt?.getTime() || 0,
      );

      const cacheAfter = await secretsCache.get(secret.id, userId);
      expect(cacheAfter.isOk()).toBe(true);
      expect(cacheAfter._unsafeUnwrap().name).toBe('Updated Name');

      const repoResult = await secretsRepo.get(secret.id, userId);
      expect(repoResult.isOk()).toBe(true);
      expect(repoResult._unsafeUnwrap().name).toBe('Updated Name');
    });
  });

  describe('delete()', () => {
    it('should delete secret from database and cache', async () => {
      const { secretsService, secretsCache, secretsRepo, userId } =
        await setup();

      const storeResult = await secretsService.store({
        correlationId: CorrelationId(),
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

      const cacheBefore = await secretsCache.get(secret.id, userId);
      expect(cacheBefore.isOk()).toBe(true);

      const deleteResult = await secretsService.delete(secret.id, userId);
      expect(deleteResult.isOk()).toBe(true);

      const getResult = await secretsService.get(secret.id, userId);
      expect(getResult.isErr()).toBe(true);

      const cacheAfter = await secretsCache.get(secret.id, userId);
      expect(cacheAfter.isErr()).toBe(true);

      const repoResult = await secretsRepo.get(secret.id, userId);
      expect(repoResult.isErr()).toBe(true);
    });
  });

  describe('all()', () => {
    it('should return all secrets for a user', async () => {
      const { secretsService, secretsRepo, userId } = await setup();

      await secretsService.store({
        correlationId: CorrelationId(),
        userId,
        value: 'secret-1',
        data: {
          type: 'stored' as const,
          schemaVersion: 1 as const,
          name: 'Secret 1',
          metadata: {},
        },
      });

      await secretsService.store({
        correlationId: CorrelationId(),
        userId,
        value: 'secret-2',
        data: {
          type: 'stored' as const,
          schemaVersion: 1 as const,
          name: 'Secret 2',
          metadata: {},
        },
      });

      await secretsService.store({
        correlationId: CorrelationId(),
        userId,
        value: 'secret-3',
        data: {
          type: 'stored' as const,
          schemaVersion: 1 as const,
          name: 'Secret 3',
          metadata: {},
        },
      });

      const allResult = await secretsService.all(userId);

      expect(allResult.isOk()).toBe(true);
      const secrets = allResult._unsafeUnwrap();
      expect(secrets.length).toBe(3);

      secrets.forEach((secret) => {
        expect(secret.encryptedValue).toBeDefined();
        expect('value' in secret).toBe(false);
      });

      const repoAllResult = await secretsRepo.all(userId);
      expect(repoAllResult.isOk()).toBe(true);
      expect(repoAllResult._unsafeUnwrap().length).toBe(3);
    });

    it('should return empty array when no secrets exist', async () => {
      const { secretsService, secretsRepo, userId } = await setup();

      const allResult = await secretsService.all(userId);

      expect(allResult.isOk()).toBe(true);
      const secrets = allResult._unsafeUnwrap();
      expect(secrets.length).toBe(0);

      const repoAllResult = await secretsRepo.all(userId);
      expect(repoAllResult.isOk()).toBe(true);
      expect(repoAllResult._unsafeUnwrap().length).toBe(0);
    });
  });

  describe('user isolation', () => {
    it('should isolate secrets between different users', async () => {
      const config = getConfig();
      const logger = getLogger();

      const usersService = createUsersService({
        appConfig: config,
        logger,
      });

      const user1Result = await usersService.create({ schemaVersion: 1 });
      const user2Result = await usersService.create({ schemaVersion: 1 });

      const user1 = user1Result._unsafeUnwrap();
      const user2 = user2Result._unsafeUnwrap();

      const secretsService = createSecretsService({
        appConfig: config,
        logger,
      });

      const user1SecretResult = await secretsService.store({
        correlationId: CorrelationId(),
        userId: user1.id,
        value: 'user1-secret',
        data: {
          type: 'stored' as const,
          schemaVersion: 1 as const,
          name: 'User 1 Secret',
          metadata: {},
        },
      });

      const user1Secret = user1SecretResult._unsafeUnwrap();

      const user2AccessResult = await secretsService.get(
        user1Secret.id,
        user2.id,
      );
      expect(user2AccessResult.isErr()).toBe(true);

      const user1AccessResult = await secretsService.get(
        user1Secret.id,
        user1.id,
      );
      expect(user1AccessResult.isOk()).toBe(true);

      const user1AllResult = await secretsService.all(user1.id);
      expect(user1AllResult._unsafeUnwrap().length).toBe(1);

      const user2AllResult = await secretsService.all(user2.id);
      expect(user2AllResult._unsafeUnwrap().length).toBe(0);
    });
  });
});
