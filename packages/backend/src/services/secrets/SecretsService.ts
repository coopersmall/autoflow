import type { ILogger } from '@backend/logger/Logger';
import type { IAppConfigurationService } from '@backend/services/configuration/AppConfigurationService';
import type { IRSAEncryptionService } from '@backend/services/encryption/RSAEncryptionService';
import { StandardService } from '@backend/services/standard/StandardService';
import {
  type Secret,
  SecretId,
  type SecretWithValue,
} from '@core/domain/secrets/Secret';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Result } from 'neverthrow';
import { revealSecret } from './actions/revealSecret';
import { storeSecret } from './actions/storeSecret';
import { createSecretsCache } from './cache/SecretsCache';
import type { RevealSecretRequest } from './domain/RevealSecretRequest';
import type { ISecretsService } from './domain/SecretsService';
import type { StoreSecretRequest } from './domain/StoreSecretRequest';
import { createSecretsRepo } from './repos/SecretsRepo';

export { createSecretsService };
export type { ISecretsService };

function createSecretsService(ctx: SecretsServiceContext): ISecretsService {
  return new SecretsService(ctx);
}

interface SecretsServiceContext {
  logger: ILogger;
  appConfig: () => IAppConfigurationService;
  encryptionService: () => IRSAEncryptionService;
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
  constructor(
    private readonly context: SecretsServiceContext,
    private readonly actions = {
      storeSecret,
      revealSecret,
    },
    private readonly dependencies = {
      createSecretsRepo,
      createSecretsCache,
    },
  ) {
    const appConfig = context.appConfig();

    super('secrets', {
      ...context,
      repo: () => this.dependencies.createSecretsRepo({ appConfig }),
      cache: () =>
        this.dependencies.createSecretsCache({
          logger: context.logger,
          appConfig,
        }),
      newId: SecretId,
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
        appConfigService: this.context.appConfig(),
        encryptionService: this.context.encryptionService(),
        secretService: this,
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
        appConfigService: this.context.appConfig(),
        encryptionService: this.context.encryptionService(),
        secretService: this,
      },
      request,
    );
  }
}
