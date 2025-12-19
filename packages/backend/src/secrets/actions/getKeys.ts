import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { Context } from '@backend/infrastructure/context';
import { type AppError, internalError } from '@core/errors';
import { err, ok, type Result } from 'neverthrow';

export interface GetKeysResult {
  privateKey: string;
  publicKey: string;
}

export interface GetKeysDeps {
  appConfig: IAppConfigurationService;
}

export function getKeys(
  ctx: Context,
  deps: GetKeysDeps,
): Result<GetKeysResult, AppError> {
  const privateKey = deps.appConfig.secretsPrivateKey;
  if (!privateKey) {
    return err(
      internalError('Missing secrets private key', {
        metadata: {
          correlationId: ctx.correlationId,
        },
      }),
    );
  }

  const publicKey = deps.appConfig.secretsPublicKey;
  if (!publicKey) {
    return err(
      internalError('Missing secrets public key', {
        metadata: {
          correlationId: ctx.correlationId,
        },
      }),
    );
  }

  return ok({ privateKey, publicKey });
}
