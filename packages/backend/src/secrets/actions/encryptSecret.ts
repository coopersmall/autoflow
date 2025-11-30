import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { IEncryptionService } from '@backend/infrastructure/encryption/domain/EncryptionService';
import type { CorrelationId } from '@core/domain/CorrelationId';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, type Result } from 'neverthrow';
import { getKeys } from './getKeys.ts';

export interface EncryptSecretRequest {
  correlationId: CorrelationId;
  value: string;
  salt: string;
}

export interface EncryptSecretContext {
  appConfig: IAppConfigurationService;
  encryption: IEncryptionService;
}

export async function encryptSecret(
  ctx: EncryptSecretContext,
  { correlationId, value, salt }: EncryptSecretRequest,
  actions = { getKeys },
): Promise<Result<Buffer, ErrorWithMetadata>> {
  const keysResult = actions.getKeys(
    { appConfig: ctx.appConfig },
    { correlationId },
  );
  if (keysResult.isErr()) return err(keysResult.error);

  const saltedValue = value + salt;

  const { publicKey } = keysResult.value;
  return ctx.encryption.encryptRSA({
    correlationId,
    data: Buffer.from(saltedValue, 'utf8'),
    publicKey: Buffer.from(publicKey, 'utf8'),
  });
}
