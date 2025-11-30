import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
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

export interface GetKeysContext {
  appConfig: IAppConfigurationService;
}

export function getKeys(
  ctx: GetKeysContext,
  { correlationId }: GetKeysRequest,
): Result<GetKeysResult, ErrorWithMetadata> {
  const privateKey = ctx.appConfig.secretsPrivateKey;
  if (!privateKey) {
    return err(
      new ErrorWithMetadata('Missing secrets private key', 'InternalServer', {
        correlationId,
      }),
    );
  }

  const publicKey = ctx.appConfig.secretsPublicKey;
  if (!publicKey) {
    return err(
      new ErrorWithMetadata('Missing secrets public key', 'InternalServer', {
        correlationId,
      }),
    );
  }

  return ok({ privateKey, publicKey });
}
