import type { IAppConfigurationService } from '@backend/services/configuration/AppConfigurationService';
import type { IRSAEncryptionService } from '@backend/services/encryption/RSAEncryptionService';
import type { StoreSecretRequest } from '@backend/services/secrets/domain/StoreSecretRequest';
import type { ISecretsService } from '@backend/services/secrets/SecretsService';
import type { Secret } from '@core/domain/secrets/Secret';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, type Result } from 'neverthrow';
import { encryptSecret } from './encryptSecret';

interface StoreSecretContext {
  appConfigService: IAppConfigurationService;
  encryptionService: IRSAEncryptionService;
  secretService: ISecretsService;
}

export async function storeSecret(
  ctx: StoreSecretContext,
  { correlationId, userId, value, data }: StoreSecretRequest,
  actions = {
    encryptSecret,
  },
): Promise<Result<Secret, ErrorWithMetadata>> {
  const salt = ctx.encryptionService.generateSalt();
  const encryptResult = await actions.encryptSecret(ctx, {
    correlationId,
    value,
    salt,
  });

  if (encryptResult.isErr()) return err(encryptResult.error);

  const secretData = {
    ...data,
    salt,
    encryptedValue: encryptResult.value.toString('base64'),
  };

  return await ctx.secretService.create(userId, secretData);
}
