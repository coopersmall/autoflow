import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { Context } from '@backend/infrastructure/context';
import type { IEncryptionService } from '@backend/infrastructure/encryption/domain/EncryptionService';
import type { RevealSecretRequest } from '@backend/secrets/domain/RevealSecretRequest';
import type { ISecretsService } from '@backend/secrets/domain/SecretsService';
import {
  isStoredSecret,
  type SecretWithValue,
} from '@core/domain/secrets/Secret';
import { type AppError, badRequest } from '@core/errors';
import { err, ok, type Result } from 'neverthrow';
import { decryptSecret } from './decryptSecret.ts';

export interface RevealSecretDeps {
  appConfig: IAppConfigurationService;
  encryption: IEncryptionService;
  secrets: ISecretsService;
}

export async function revealSecret(
  ctx: Context,
  { userId, id }: RevealSecretRequest,
  deps: RevealSecretDeps,
  actions = {
    decryptSecret,
  },
): Promise<Result<SecretWithValue, AppError>> {
  const secretResult = await deps.secrets.get(ctx, id, userId);
  if (secretResult.isErr()) return err(secretResult.error);

  const secret = secretResult.value;
  if (!isStoredSecret(secret)) {
    return err(
      badRequest('Secret type not supported for decryption', {
        metadata: {
          correlationId: ctx.correlationId,
          secretId: id,
        },
      }),
    );
  }

  const valueResult = await actions.decryptSecret(
    ctx,
    {
      encryptedValue: secret.encryptedValue,
      salt: secret.salt,
    },
    { appConfig: deps.appConfig, encryption: deps.encryption },
  );

  if (valueResult.isErr()) return err(valueResult.error);

  return ok({ ...secret, value: valueResult.value });
}
