import type { IAppConfigurationService } from '@backend/services/configuration/AppConfigurationService';
import type { IRSAEncryptionService } from '@backend/services/encryption/RSAEncryptionService';
import type { CorrelationId } from '@core/domain/CorrelationId';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, type Result } from 'neverthrow';
import { getKeys } from './getKeys';

export interface EncryptSecretRequest {
  correlationId: CorrelationId;
  value: string;
  salt: string;
}

export async function encryptSecret(
  ctx: {
    appConfigService: IAppConfigurationService;
    encryptionService: IRSAEncryptionService;
  },
  { correlationId, value, salt }: EncryptSecretRequest,
  actions = { getKeys },
): Promise<Result<Buffer, ErrorWithMetadata>> {
  const keysResult = actions.getKeys(ctx, { correlationId });
  if (keysResult.isErr()) return err(keysResult.error);

  const saltedValue = value + salt;

  const { publicKey } = keysResult.value;
  return ctx.encryptionService.encrypt({
    correlationId,
    data: Buffer.from(saltedValue, 'utf8'),
    publicKey: Buffer.from(publicKey, 'utf8'),
  });
}
