import type { ILogger } from '@backend/logger/Logger';
import type { CorrelationId } from '@core/domain/CorrelationId';
import {
  isValidJWTClaimStructure,
  type JWTClaim,
  SIGNATURE_ALGORITHM,
} from '@core/domain/jwt/JWTClaim';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { importSPKI, jwtVerify } from 'jose';
import { err, ok, type Result } from 'neverthrow';

export interface DecodeClaimRequest {
  correlationId?: CorrelationId;
  token: string;
  publicKey: string;
}

export async function decodeClaim(
  ctx: {
    logger: ILogger;
  },
  { correlationId, token, publicKey: rawKey }: DecodeClaimRequest,
  actions = { importSPKI, jwtVerify },
): Promise<Result<JWTClaim, ErrorWithMetadata>> {
  let publicKey: CryptoKey | Uint8Array;

  try {
    publicKey = await actions.importSPKI(rawKey, SIGNATURE_ALGORITHM, {
      extractable: true,
    });
    const result = await actions.jwtVerify(token, publicKey);

    if (!isValidJWTClaimStructure(result.payload)) {
      const error = new ErrorWithMetadata(
        'Invalid JWT claim structure',
        'InternalServer',
        { correlationId, payload: result.payload },
      );
      ctx.logger.error('JWT claim structure is invalid', error, {
        correlationId,
      });
      return err(error);
    }

    ctx.logger.debug('Decoded JWT claim', { correlationId });
    return ok(result.payload);
  } catch (cause) {
    const error = new ErrorWithMetadata(
      'Failed to verify JWT claim',
      'Unauthorized',
      { correlationId, token, cause },
    );
    ctx.logger.error('Failed to verify JWT token', error, { correlationId });
    return err(error);
  }
}
