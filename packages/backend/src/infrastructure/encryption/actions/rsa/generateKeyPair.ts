import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { CorrelationId } from '@core/domain/CorrelationId';
import { SIGNATURE_ALGORITHM } from '@core/domain/jwt/JWTClaim';
import { type AppError, internalError } from '@core/errors';
import {
  exportPKCS8,
  exportSPKI,
  generateKeyPair as joseGenerateKeyPair,
} from 'jose';
import { err, ok, type Result } from 'neverthrow';

export interface GenerateKeyPairRequest {
  correlationId?: CorrelationId;
}

export interface RSAKeyPair {
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
): Promise<Result<RSAKeyPair, AppError>> {
  try {
    const { privateKey, publicKey } = await actions.generateKeyPair(
      SIGNATURE_ALGORITHM,
      { extractable: true },
    );

    const privatePKCS8 = await actions.exportPKCS8(privateKey);
    const publicSPKI = await actions.exportSPKI(publicKey);

    ctx.logger.debug('Generated RSA key pair', { correlationId });

    return ok({
      privateKey: privatePKCS8,
      publicKey: publicSPKI,
    });
  } catch (cause) {
    const error = internalError('Failed to generate RSA key pair', {
      cause,
      metadata: { correlationId },
    });
    ctx.logger.error('Failed to generate RSA key pair', error, {
      correlationId,
    });
    return err(error);
  }
}
