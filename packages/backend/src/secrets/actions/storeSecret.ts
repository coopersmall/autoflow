import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { IEncryptionService } from '@backend/infrastructure/encryption/domain/EncryptionService';
import type { ISecretsService } from '@backend/secrets/domain/SecretsService';
import type { StoreSecretRequest } from '@backend/secrets/domain/StoreSecretRequest';
import type { Secret } from '@core/domain/secrets/Secret';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, type Result } from 'neverthrow';
import { encryptSecret } from './encryptSecret.ts';

export interface StoreSecretContext {
  appConfig: IAppConfigurationService;
  encryption: IEncryptionService;
  secrets: ISecretsService;
}

export async function storeSecret(
  ctx: StoreSecretContext,
  { correlationId, userId, value, data }: StoreSecretRequest,
  actions = {
    encryptSecret,
  },
): Promise<Result<Secret, ErrorWithMetadata>> {
  const salt = ctx.encryption.generateSalt();
  const encryptResult = await actions.encryptSecret(
    { appConfig: ctx.appConfig, encryption: ctx.encryption },
    {
      correlationId,
      value,
      salt,
    },
  );

  if (encryptResult.isErr()) return err(encryptResult.error);

  const secretData = {
    ...data,
    salt,
    encryptedValue: encryptResult.value.toString('base64'),
  };

  return await ctx.secrets.create(userId, secretData);
}
