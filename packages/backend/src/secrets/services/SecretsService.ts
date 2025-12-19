import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { Context } from '@backend/infrastructure/context';
import { createEncryptionService } from '@backend/infrastructure/encryption';
import type { IEncryptionService } from '@backend/infrastructure/encryption/domain/EncryptionService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import { StandardService } from '@backend/infrastructure/services/StandardService';
import { revealSecret } from '@backend/secrets/actions/revealSecret';
import { storeSecret } from '@backend/secrets/actions/storeSecret';
import { createSecretsCache } from '@backend/secrets/cache/SecretsCache';
import type { RevealSecretRequest } from '@backend/secrets/domain/RevealSecretRequest';
import type { ISecretsService } from '@backend/secrets/domain/SecretsService';
import type { StoreSecretRequest } from '@backend/secrets/domain/StoreSecretRequest';
import { createSecretsRepo } from '@backend/secrets/repos/SecretsRepo';
import {
  type Secret,
  SecretId,
  type SecretWithValue,
} from '@core/domain/secrets/Secret';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

export function createSecretsService(
  config: SecretsServiceConfig,
): ISecretsService {
  return Object.freeze(new SecretsService(config));
}

interface SecretsServiceConfig {
  logger: ILogger;
  appConfig: IAppConfigurationService;
}

interface SecretsServiceActions {
  storeSecret: typeof storeSecret;
  revealSecret: typeof revealSecret;
}

interface SecretsServiceDependencies {
  createEncryptionService: typeof createEncryptionService;
  createSecretsRepo: typeof createSecretsRepo;
  createSecretsCache: typeof createSecretsCache;
}

/**
 * Service for managing encrypted secrets with RSA encryption.
 * Extends StandardService to provide CRUD operations with automatic encryption/decryption.
 * All secret values are encrypted before storage and decrypted on retrieval.
 */
class SecretsService
  extends StandardService<SecretId, Secret>
  implements ISecretsService
{
  private readonly encryption: IEncryptionService;

  constructor(
    private readonly secretsConfig: SecretsServiceConfig,
    private readonly actions: SecretsServiceActions = {
      storeSecret,
      revealSecret,
    },
    dependencies: SecretsServiceDependencies = {
      createEncryptionService,
      createSecretsRepo,
      createSecretsCache,
    },
  ) {
    const appConfig = secretsConfig.appConfig;

    super('secrets', {
      ...secretsConfig,
      repo: () => dependencies.createSecretsRepo({ appConfig }),
      cache: () =>
        dependencies.createSecretsCache({
          logger: secretsConfig.logger,
          appConfig,
        }),
      newId: SecretId,
    });

    this.encryption = dependencies.createEncryptionService({
      logger: secretsConfig.logger,
    });
  }

  /**
   * Stores a secret with RSA encryption using generated salt.
   * @param ctx - Request context for tracing and cancellation
   * @param request - Storage request object
   * @param request.userId - ID of the user storing the secret for authorization
   * @param request.value - Plain text secret value to be encrypted and stored
   * @param request.data - Secret metadata including name, type, and other properties
   * @returns Promise resolving to stored secret metadata (without plain text value) or error details
   */
  async store(
    ctx: Context,
    request: StoreSecretRequest,
  ): Promise<Result<Secret, AppError>> {
    return this.actions.storeSecret(ctx, request, {
      appConfig: this.secretsConfig.appConfig,
      encryption: this.encryption,
      secrets: this,
    });
  }

  /**
   * Retrieves and decrypts a stored secret by ID.
   * @param ctx - Request context for tracing and cancellation
   * @param request - Revelation request object
   * @param request.userId - ID of the user requesting the secret for authorization
   * @param request.id - Unique identifier of the secret to retrieve and decrypt
   * @returns Promise resolving to secret metadata with decrypted value or error details
   */
  async reveal(
    ctx: Context,
    request: RevealSecretRequest,
  ): Promise<Result<SecretWithValue, AppError>> {
    return this.actions.revealSecret(ctx, request, {
      appConfig: this.secretsConfig.appConfig,
      encryption: this.encryption,
      secrets: this,
    });
  }
}
