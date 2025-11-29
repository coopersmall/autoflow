import type { ILogger } from '@backend/logger/Logger';
import type { CorrelationId } from '@core/domain/CorrelationId';
import { SIGNATURE_ALGORITHM } from '@core/domain/jwt/JWTClaim';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import {
  exportPKCS8,
  exportSPKI,
  generateKeyPair as joseGenerateKeyPair,
} from 'jose';
import { err, ok, type Result } from 'neverthrow';

export interface GenerateKeyPairRequest {
  correlationId?: CorrelationId;
}

export interface JWTKeyPair {
  privateKey: string;
  publicKey: string;
}

export async function generateKeyPair(
  ctx: { logger: ILogger },
  { correlationId }: GenerateKeyPairRequest,
  actions = {
    generateKeyPair: joseGenerateKeyPair,
    exportSPKI,
    exportPKCS8,
  },
): Promise<Result<JWTKeyPair, ErrorWithMetadata>> {
  try {
    const { privateKey, publicKey } = await actions.generateKeyPair(
      SIGNATURE_ALGORITHM,
      { extractable: true },
    );

    const privatePKCS8 = await actions.exportPKCS8(privateKey);
    const publicSPKI = await actions.exportSPKI(publicKey);

    ctx.logger.debug('Generated JWT key pair', { correlationId });

    return ok({
      privateKey: privatePKCS8,
      publicKey: publicSPKI,
    });
  } catch (cause) {
    const error = new ErrorWithMetadata(
      'Failed to generate JWT key pair',
      'InternalServer',
      { correlationId, cause },
    );
    ctx.logger.error('Failed to generate JWT key pair', error, {
      correlationId,
    });
    return err(error);
  }
}
