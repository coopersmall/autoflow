import { constants, publicEncrypt } from 'node:crypto';
import type { ILogger } from '@backend/logger/Logger';
import type { CorrelationId } from '@core/domain/CorrelationId';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { ExtractMethods } from '@core/types';
import { err, ok, type Result } from 'neverthrow';

export interface EncryptRSARequest {
  correlationId: CorrelationId;
  data: Buffer;
  publicKey: Buffer;
}

export async function encryptRSA(
  ctx: { logger: ExtractMethods<ILogger> },
  { correlationId, data, publicKey }: EncryptRSARequest,
  actions = { publicEncrypt },
): Promise<Result<Buffer, ErrorWithMetadata>> {
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
    const cause = new ErrorWithMetadata('Encryption error', 'InternalServer', {
      correlationId,
      cause: error,
    });
    ctx.logger.error('Failed to encrypt data', cause, { correlationId });
    return err(cause);
  }
}
