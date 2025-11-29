import type { IAppConfigurationService } from '@backend/services/configuration/AppConfigurationService';
import type { IRSAEncryptionService } from '@backend/services/encryption/RSAEncryptionService';
import type { RevealSecretRequest } from '@backend/services/secrets/domain/RevealSecretRequest';
import type { ISecretsService } from '@backend/services/secrets/SecretsService';
import {
  isStoredSecret,
  type SecretWithValue,
} from '@core/domain/secrets/Secret';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';
import { decryptSecret } from './decryptSecret';

interface RevealSecretContext {
  appConfigService: IAppConfigurationService;
  encryptionService: IRSAEncryptionService;
  secretService: ISecretsService;
}

export async function revealSecret(
  ctx: RevealSecretContext,
  { correlationId, userId, id }: RevealSecretRequest,
  actions = {
    decryptSecret,
  },
): Promise<Result<SecretWithValue, ErrorWithMetadata>> {
  const secretResult = await ctx.secretService.get(id, userId);
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

  const valueResult = await actions.decryptSecret(ctx, {
    correlationId,
    encryptedValue: secret.encryptedValue,
    salt: secret.salt,
  });

  if (valueResult.isErr()) return err(valueResult.error);

  return ok({ ...secret, value: valueResult.value });
}
