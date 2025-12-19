import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { Context } from '@backend/infrastructure/context';
import type { IEncryptionService } from '@backend/infrastructure/encryption/domain/EncryptionService';
import type { ISecretsService } from '@backend/secrets/domain/SecretsService';
import type { StoreSecretRequest } from '@backend/secrets/domain/StoreSecretRequest';
import type { Secret } from '@core/domain/secrets/Secret';
import type { AppError } from '@core/errors/AppError';
import { err, type Result } from 'neverthrow';
import { encryptSecret } from './encryptSecret.ts';

export interface StoreSecretDeps {
  appConfig: IAppConfigurationService;
  encryption: IEncryptionService;
  secrets: ISecretsService;
}

export async function storeSecret(
  ctx: Context,
  { userId, value, data }: StoreSecretRequest,
  deps: StoreSecretDeps,
  actions = {
    encryptSecret,
  },
): Promise<Result<Secret, AppError>> {
  const salt = deps.encryption.generateSalt();
  const encryptResult = await actions.encryptSecret(
    ctx,
    {
      value,
      salt,
    },
    { appConfig: deps.appConfig, encryption: deps.encryption },
  );

  if (encryptResult.isErr()) return err(encryptResult.error);

  const secretData = {
    ...data,
    salt,
    encryptedValue: encryptResult.value.toString('base64'),
  };

  return await deps.secrets.create(ctx, userId, secretData);
}
