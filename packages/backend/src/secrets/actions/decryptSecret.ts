import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { Context } from '@backend/infrastructure/context';
import type { IEncryptionService } from '@backend/infrastructure/encryption/domain/EncryptionService';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import { getKeys } from './getKeys';

export interface DecryptSecretRequest {
  encryptedValue: string;
  salt: string;
}

export interface DecryptSecretDeps {
  appConfig: IAppConfigurationService;
  encryption: IEncryptionService;
}

export async function decryptSecret(
  ctx: Context,
  { encryptedValue, salt }: DecryptSecretRequest,
  deps: DecryptSecretDeps,
  actions = { getKeys },
): Promise<Result<string, AppError>> {
  const keysResult = actions.getKeys(ctx, { appConfig: deps.appConfig });
  if (keysResult.isErr()) return err(keysResult.error);

  const { privateKey } = keysResult.value;
  const decryptResult = await deps.encryption.decryptRSA(ctx, {
    data: Buffer.from(encryptedValue, 'base64'),
    privateKey: Buffer.from(privateKey, 'utf8'),
  });

  if (decryptResult.isErr()) return err(decryptResult.error);

  const saltedValue = decryptResult.value.toString('utf8');
  return ok(saltedValue.slice(0, -salt.length));
}
