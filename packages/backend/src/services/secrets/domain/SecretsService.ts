import type { IStandardService } from '@backend/services/standard/StandardService';
import type { Secret, SecretId } from '@core/domain/secrets/Secret';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Result } from 'neverthrow';
import type { RevealSecretRequest } from './RevealSecretRequest';
import type { StoreSecretRequest } from './StoreSecretRequest';

export type ISecretsService = IStandardService<SecretId, Secret> & {
  reveal(
    request: RevealSecretRequest,
  ): Promise<Result<Secret, ErrorWithMetadata>>;
  store(
    request: StoreSecretRequest,
  ): Promise<Result<Secret, ErrorWithMetadata>>;
};
