import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { CorrelationId } from '@core/domain/CorrelationId';
import { type JWTClaim, SIGNATURE_ALGORITHM } from '@core/domain/jwt/JWTClaim';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { importPKCS8, SignJWT } from 'jose';
import { err, ok, type Result } from 'neverthrow';

export interface EncodeTokenRequest {
  correlationId?: CorrelationId;
  claim: JWTClaim;
  privateKey: string;
}

export async function encodeToken(
  ctx: {
    logger: ILogger;
  },
  { correlationId, claim, privateKey: rawKey }: EncodeTokenRequest,
  actions = { importPKCS8 },
): Promise<Result<string, ErrorWithMetadata>> {
  let privateKey: CryptoKey | Uint8Array;
  try {
    privateKey = await actions.importPKCS8(rawKey, SIGNATURE_ALGORITHM);
  } catch (cause) {
    const error = new ErrorWithMetadata(
      'Failed to import private key',
      'InternalServer',
      { correlationId, claim, cause },
    );
    ctx.logger.error('Failed to import JWT private key', error, {
      correlationId,
    });
    return err(error);
  }

  try {
    const signature = await new SignJWT(claim)
      .setProtectedHeader({
        alg: SIGNATURE_ALGORITHM,
        typ: 'JWT',
      })
      .sign(privateKey);

    ctx.logger.debug('Encoded JWT token', { correlationId });
    return ok(signature);
  } catch (cause) {
    const error = new ErrorWithMetadata(
      'Failed to encode JWT token',
      'InternalServer',
      { correlationId, claim, cause },
    );
    ctx.logger.error('Failed to sign JWT token', error, { correlationId });
    return err(error);
  }
}
