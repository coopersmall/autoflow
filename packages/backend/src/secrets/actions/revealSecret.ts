import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { IEncryptionService } from '@backend/infrastructure/encryption/domain/EncryptionService';
import type { RevealSecretRequest } from '@backend/secrets/domain/RevealSecretRequest';
import type { ISecretsService } from '@backend/secrets/domain/SecretsService';
import {
  isStoredSecret,
  type SecretWithValue,
} from '@core/domain/secrets/Secret';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';
import { decryptSecret } from './decryptSecret.ts';

export interface RevealSecretContext {
  appConfig: IAppConfigurationService;
  encryption: IEncryptionService;
  secrets: ISecretsService;
}

export async function revealSecret(
  ctx: RevealSecretContext,
  { correlationId, userId, id }: RevealSecretRequest,
  actions = {
    decryptSecret,
  },
): Promise<Result<SecretWithValue, ErrorWithMetadata>> {
  const secretResult = await ctx.secrets.get(id, userId);
  if (secretResult.isErr()) return err(secretResult.error);

  const secret = secretResult.value;
  if (!isStoredSecret(secret)) {
    return err(
      new ErrorWithMetadata(
        'Secret type not supported for decryption',
        'BadRequest',
        {
          correlationId,
          secretId: id,
        },
      ),
    );
  }

  const valueResult = await actions.decryptSecret(
    { appConfig: ctx.appConfig, encryption: ctx.encryption },
    {
      correlationId,
      encryptedValue: secret.encryptedValue,
      salt: secret.salt,
    },
  );

  if (valueResult.isErr()) return err(valueResult.error);

  return ok({ ...secret, value: valueResult.value });
}
