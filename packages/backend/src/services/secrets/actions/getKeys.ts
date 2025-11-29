import type { IAppConfigurationService } from '@backend/services/configuration/AppConfigurationService';
import type { CorrelationId } from '@core/domain/CorrelationId';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';

export interface GetKeysRequest {
  correlationId: CorrelationId;
}

export interface GetKeysResult {
  privateKey: string;
  publicKey: string;
}

export function getKeys(
  ctx: { appConfigService: IAppConfigurationService },
  { correlationId }: GetKeysRequest,
): Result<GetKeysResult, ErrorWithMetadata> {
  const privateKey = ctx.appConfigService.secretsPrivateKey;
  if (!privateKey) {
    return err(
      new ErrorWithMetadata('Missing secrets private key', 'InternalServer', {
        correlationId,
      }),
    );
  }

  const publicKey = ctx.appConfigService.secretsPublicKey;
  if (!publicKey) {
    return err(
      new ErrorWithMetadata('Missing secrets public key', 'InternalServer', {
        correlationId,
      }),
    );
  }

  return ok({ privateKey, publicKey });
}
