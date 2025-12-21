import type { Context } from '@backend/infrastructure/context';
import type { IStandardService } from '@backend/infrastructure/services/StandardService';
import type { Secret, SecretId } from '@core/domain/secrets/Secret';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';
import type { RevealSecretRequest } from './RevealSecretRequest';
import type { StoreSecretRequest } from './StoreSecretRequest';

export type ISecretsService = Readonly<
  IStandardService<SecretId, Secret> & {
    reveal(
      ctx: Context,
      request: RevealSecretRequest,
    ): Promise<Result<Secret, AppError>>;
    store(
      ctx: Context,
      request: StoreSecretRequest,
    ): Promise<Result<Secret, AppError>>;
  }
>;
