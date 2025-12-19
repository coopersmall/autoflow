import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { Context } from '@backend/infrastructure/context';
import type { IEncryptionService } from '@backend/infrastructure/encryption/domain/EncryptionService';
import type { AppError } from '@core/errors/AppError';
import { err, type Result } from 'neverthrow';
import { getKeys } from './getKeys.ts';

export interface EncryptSecretRequest {
  value: string;
  salt: string;
}

export interface EncryptSecretDeps {
  appConfig: IAppConfigurationService;
  encryption: IEncryptionService;
}

export async function encryptSecret(
  ctx: Context,
  { value, salt }: EncryptSecretRequest,
  deps: EncryptSecretDeps,
  actions = { getKeys },
): Promise<Result<Buffer, AppError>> {
  const keysResult = actions.getKeys(ctx, { appConfig: deps.appConfig });
  if (keysResult.isErr()) return err(keysResult.error);

  const saltedValue = value + salt;

  const { publicKey } = keysResult.value;
  return deps.encryption.encryptRSA(ctx, {
    data: Buffer.from(saltedValue, 'utf8'),
    publicKey: Buffer.from(publicKey, 'utf8'),
  });
}
