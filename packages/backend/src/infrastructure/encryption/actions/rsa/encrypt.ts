import { constants, publicEncrypt } from 'node:crypto';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import { type AppError, internalError } from '@core/errors';
import type { ExtractMethods } from '@core/types';
import { err, ok, type Result } from 'neverthrow';

export interface EncryptRSARequest {
  data: Buffer;
  publicKey: Buffer;
}

export async function encryptRSA(
  ctx: { logger: ExtractMethods<ILogger>; correlationId: string },
  { data, publicKey }: EncryptRSARequest,
  actions = { publicEncrypt },
): Promise<Result<Buffer, AppError>> {
  try {
    const encrypted = actions.publicEncrypt(
      {
        key: publicKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
      },
      data,
    );
    return ok(encrypted);
  } catch (error) {
    const cause = internalError('Encryption error', {
      cause: error,
      metadata: { correlationId: ctx.correlationId },
    });
    ctx.logger.error('Failed to encrypt data', cause, {
      correlationId: ctx.correlationId,
    });
    return err(cause);
  }
}
