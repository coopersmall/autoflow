import { constants, privateDecrypt } from 'node:crypto';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import { type AppError, internalError } from '@core/errors';
import type { ExtractMethods } from '@core/types';
import { err, ok, type Result } from 'neverthrow';

export interface DecryptRSARequest {
  data: Buffer;
  privateKey: Buffer;
}

export async function decryptRSA(
  ctx: { logger: ExtractMethods<ILogger>; correlationId: string },
  { data, privateKey }: DecryptRSARequest,
  actions = { privateDecrypt },
): Promise<Result<Buffer, AppError>> {
  try {
    const decrypted = actions.privateDecrypt(
      {
        key: privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
      },
      data,
    );
    return ok(decrypted);
  } catch (error) {
    const cause = internalError('Decryption error', {
      cause: error,
      metadata: { correlationId: ctx.correlationId },
    });
    ctx.logger.error('Failed to decrypt data', cause, {
      correlationId: ctx.correlationId,
    });
    return err(cause);
  }
}
