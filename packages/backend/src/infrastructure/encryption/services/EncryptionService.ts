import type { Context } from '@backend/infrastructure/context';
import {
  type DecodeTokenRequest,
  decodeToken,
} from '@backend/infrastructure/encryption/actions/jwt/decodeToken';
import {
  type EncodeTokenRequest,
  encodeToken,
} from '@backend/infrastructure/encryption/actions/jwt/encodeToken';
import {
  type DecryptRSARequest,
  decryptRSA,
} from '@backend/infrastructure/encryption/actions/rsa/decrypt';
import {
  type EncryptRSARequest,
  encryptRSA,
} from '@backend/infrastructure/encryption/actions/rsa/encrypt';
import {
  generateKeyPair,
  type RSAKeyPair,
} from '@backend/infrastructure/encryption/actions/rsa/generateKeyPair';
import { generateSalt } from '@backend/infrastructure/encryption/actions/rsa/generateSalt';
import type { IEncryptionService } from '@backend/infrastructure/encryption/domain/EncryptionService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { JWTClaim } from '@core/domain/jwt/JWTClaim';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

export { createEncryptionService };

function createEncryptionService(
  config: EncryptionServiceConfig,
): IEncryptionService {
  return Object.freeze(new EncryptionService(config));
}

interface EncryptionServiceConfig {
  logger: ILogger;
}

interface EncryptionServiceActions {
  encryptRSA: typeof encryptRSA;
  decryptRSA: typeof decryptRSA;
  generateSalt: typeof generateSalt;
  generateKeyPair: typeof generateKeyPair;
  encodeToken: typeof encodeToken;
  decodeToken: typeof decodeToken;
}

/**
 * Unified service for all encryption operations.
 * Provides RSA encryption/decryption, JWT token encoding/decoding, and key generation.
 */
class EncryptionService implements IEncryptionService {
  constructor(
    private readonly config: EncryptionServiceConfig,
    private readonly actions: EncryptionServiceActions = {
      encryptRSA,
      decryptRSA,
      generateSalt,
      generateKeyPair,
      encodeToken,
      decodeToken,
    },
  ) {}

  /**
   * Encrypts data using RSA public key with PKCS1 padding.
   * @param ctx - Request context for tracing and cancellation
   * @param request - Encryption request object
   * @param request.data - Binary data buffer to be encrypted
   * @param request.publicKey - RSA public key in PEM format as buffer
   * @returns Promise resolving to encrypted data buffer or error details
   */
  async encryptRSA(
    ctx: Context,
    request: EncryptRSARequest,
  ): Promise<Result<Buffer, AppError>> {
    return this.actions.encryptRSA(
      { ...this.config, correlationId: String(ctx.correlationId) },
      request,
    );
  }

  /**
   * Decrypts RSA-encrypted data using private key with PKCS1 padding.
   * @param ctx - Request context for tracing and cancellation
   * @param request - Decryption request object
   * @param request.data - Encrypted binary data buffer to be decrypted
   * @param request.privateKey - RSA private key in PEM format as buffer
   * @returns Promise resolving to decrypted data buffer or error details
   */
  async decryptRSA(
    ctx: Context,
    request: DecryptRSARequest,
  ): Promise<Result<Buffer, AppError>> {
    return this.actions.decryptRSA(
      { ...this.config, correlationId: String(ctx.correlationId) },
      request,
    );
  }

  /**
   * Generates cryptographically secure random salt for password hashing.
   * @param length - Salt length in bytes, defaults to 32 bytes (64 hex characters)
   * @returns Hex-encoded random salt string
   */
  generateSalt(length?: number): string {
    return this.actions.generateSalt({ length });
  }

  /**
   * Generates a new RSA key pair for JWT signing and verification.
   * Uses RS256 algorithm with extractable keys.
   * @param ctx - Request context for tracing and cancellation
   * @returns Promise resolving to RSA key pair (private and public keys in PEM format) or error details
   */
  async generateKeyPair(ctx: Context): Promise<Result<RSAKeyPair, AppError>> {
    return this.actions.generateKeyPair(this.config, ctx);
  }

  /**
   * Encodes a JWT claim into a signed token string using RSA private key.
   * @param ctx - Request context for tracing and cancellation
   * @param request - Encoding request object
   * @param request.claim - JWT claim object to encode
   * @param request.privateKey - RSA private key in PEM format for signing
   * @returns Promise resolving to signed JWT token string or error details
   */
  async encodeJWT(
    ctx: Context,
    request: EncodeTokenRequest,
  ): Promise<Result<string, AppError>> {
    return this.actions.encodeToken(this.config, {
      ...request,
      correlationId: ctx.correlationId,
    });
  }

  /**
   * Decodes and verifies a JWT token string using RSA public key.
   * @param ctx - Request context for tracing and cancellation
   * @param request - Decoding request object
   * @param request.token - Signed JWT token string to decode
   * @param request.publicKey - RSA public key in PEM format for verification
   * @returns Promise resolving to verified JWT claim object or error details
   */
  async decodeJWT(
    ctx: Context,
    request: DecodeTokenRequest,
  ): Promise<Result<JWTClaim, AppError>> {
    return this.actions.decodeToken(this.config, {
      ...request,
      correlationId: ctx.correlationId,
    });
  }
}
