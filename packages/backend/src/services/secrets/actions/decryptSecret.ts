import type { IAppConfigurationService } from '@backend/services/configuration/AppConfigurationService';
import type { IRSAEncryptionService } from '@backend/services/encryption/RSAEncryptionService';
import type { CorrelationId } from '@core/domain/CorrelationId';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';
import { getKeys } from './getKeys';

export interface DecryptSecretRequest {
  correlationId: CorrelationId;
  encryptedValue: string;
  salt: string;
}

export async function decryptSecret(
  ctx: {
    appConfigService: IAppConfigurationService;
    encryptionService: IRSAEncryptionService;
  },
  { correlationId, encryptedValue, salt }: DecryptSecretRequest,
  actions = { getKeys },
): Promise<Result<string, ErrorWithMetadata>> {
  const keysResult = actions.getKeys(ctx, { correlationId });
  if (keysResult.isErr()) return err(keysResult.error);

  const { privateKey } = keysResult.value;
  const decryptResult = await ctx.encryptionService.decrypt({
    correlationId,
    data: Buffer.from(encryptedValue, 'base64'),
    privateKey: Buffer.from(privateKey, 'utf8'),
  });

  if (decryptResult.isErr()) return err(decryptResult.error);

  const saltedValue = decryptResult.value.toString('utf8');
  return ok(saltedValue.slice(0, -salt.length));
}
