import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { IEncryptionService } from '@backend/infrastructure/encryption/domain/EncryptionService';
import type { CorrelationId } from '@core/domain/CorrelationId';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';
import { getKeys } from './getKeys.ts';

export interface DecryptSecretRequest {
  correlationId: CorrelationId;
  encryptedValue: string;
  salt: string;
}

export interface DecryptSecretContext {
  appConfig: IAppConfigurationService;
  encryption: IEncryptionService;
}

export async function decryptSecret(
  ctx: DecryptSecretContext,
  { correlationId, encryptedValue, salt }: DecryptSecretRequest,
  actions = { getKeys },
): Promise<Result<string, ErrorWithMetadata>> {
  const keysResult = actions.getKeys(
    { appConfig: ctx.appConfig },
    { correlationId },
  );
  if (keysResult.isErr()) return err(keysResult.error);

  const { privateKey } = keysResult.value;
  const decryptResult = await ctx.encryption.decryptRSA({
    correlationId,
    data: Buffer.from(encryptedValue, 'base64'),
    privateKey: Buffer.from(privateKey, 'utf8'),
  });

  if (decryptResult.isErr()) return err(decryptResult.error);

  const saltedValue = decryptResult.value.toString('utf8');
  return ok(saltedValue.slice(0, -salt.length));
}
