import { constants, privateDecrypt } from 'node:crypto';
import type { ILogger } from '@backend/logger/Logger';
import type { CorrelationId } from '@core/domain/CorrelationId';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { ExtractMethods } from '@core/types';
import { err, ok, type Result } from 'neverthrow';

export interface DecryptRSARequest {
  correlationId: CorrelationId;
  data: Buffer;
  privateKey: Buffer;
}

export async function decryptRSA(
  ctx: { logger: ExtractMethods<ILogger> },
  { correlationId, data, privateKey }: DecryptRSARequest,
  actions = { privateDecrypt },
): Promise<Result<Buffer, ErrorWithMetadata>> {
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
    const cause = new ErrorWithMetadata('Decryption error', 'InternalServer', {
      correlationId,
      cause: error,
    });
    ctx.logger.error('Failed to decrypt data', cause, { correlationId });
    return err(cause);
  }
}
