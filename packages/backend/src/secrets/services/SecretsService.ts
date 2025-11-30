import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
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
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Result } from 'neverthrow';

export function createSecretsService(
  ctx: SecretsServiceContext,
): ISecretsService {
  return Object.freeze(new SecretsService(ctx));
}

interface SecretsServiceContext {
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
    private readonly context: SecretsServiceContext,
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
    const appConfig = context.appConfig;

    super('secrets', {
      ...context,
      repo: () => dependencies.createSecretsRepo({ appConfig }),
      cache: () =>
        dependencies.createSecretsCache({
          logger: context.logger,
          appConfig,
        }),
      newId: SecretId,
    });

    this.encryption = dependencies.createEncryptionService({
      logger: context.logger,
    });
  }

  /**
   * Stores a secret with RSA encryption using generated salt.
   * @param request - Storage request object
   * @param request.correlationId - Unique identifier for tracking this operation across logs
   * @param request.userId - ID of the user storing the secret for authorization
   * @param request.value - Plain text secret value to be encrypted and stored
   * @param request.data - Secret metadata including name, type, and other properties
   * @returns Promise resolving to stored secret metadata (without plain text value) or error details
   */
  async store(
    request: StoreSecretRequest,
  ): Promise<Result<Secret, ErrorWithMetadata>> {
    return this.actions.storeSecret(
      {
        appConfig: this.context.appConfig,
        encryption: this.encryption,
        secrets: this,
      },
      request,
    );
  }

  /**
   * Retrieves and decrypts a stored secret by ID.
   * @param request - Revelation request object
   * @param request.correlationId - Unique identifier for tracking this operation across logs
   * @param request.userId - ID of the user requesting the secret for authorization
   * @param request.id - Unique identifier of the secret to retrieve and decrypt
   * @returns Promise resolving to secret metadata with decrypted value or error details
   */
  async reveal(
    request: RevealSecretRequest,
  ): Promise<Result<SecretWithValue, ErrorWithMetadata>> {
    return this.actions.revealSecret(
      {
        appConfig: this.context.appConfig,
        encryption: this.encryption,
        secrets: this,
      },
      request,
    );
  }
}
