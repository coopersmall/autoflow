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
  type GenerateKeyPairRequest,
  generateKeyPair,
  type RSAKeyPair,
} from '@backend/infrastructure/encryption/actions/rsa/generateKeyPair';
import { generateSalt } from '@backend/infrastructure/encryption/actions/rsa/generateSalt';
import type { IEncryptionService } from '@backend/infrastructure/encryption/domain/EncryptionService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { JWTClaim } from '@core/domain/jwt/JWTClaim';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Result } from 'neverthrow';

export { createEncryptionService };

function createEncryptionService(
  ctx: EncryptionServiceContext,
): IEncryptionService {
  return Object.freeze(new EncryptionService(ctx));
}

interface EncryptionServiceContext {
  logger: ILogger;
}

/**
 * Unified service for all encryption operations.
 * Provides RSA encryption/decryption, JWT token encoding/decoding, and key generation.
 */
class EncryptionService implements IEncryptionService {
  constructor(
    private readonly context: EncryptionServiceContext,
    private readonly actions = {
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
   * @param request - Encryption request object
   * @param request.correlationId - Unique identifier for tracking this operation across logs
   * @param request.data - Binary data buffer to be encrypted
   * @param request.publicKey - RSA public key in PEM format as buffer
   * @returns Promise resolving to encrypted data buffer or error details
   */
  async encryptRSA(
    request: EncryptRSARequest,
  ): Promise<Result<Buffer, ErrorWithMetadata>> {
    return this.actions.encryptRSA(this.context, request);
  }

  /**
   * Decrypts RSA-encrypted data using private key with PKCS1 padding.
   * @param request - Decryption request object
   * @param request.correlationId - Unique identifier for tracking this operation across logs
   * @param request.data - Encrypted binary data buffer to be decrypted
   * @param request.privateKey - RSA private key in PEM format as buffer
   * @returns Promise resolving to decrypted data buffer or error details
   */
  async decryptRSA(
    request: DecryptRSARequest,
  ): Promise<Result<Buffer, ErrorWithMetadata>> {
    return this.actions.decryptRSA(this.context, request);
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
   * @param request - Key generation request object
   * @param request.correlationId - Unique identifier for tracking this operation across logs
   * @returns Promise resolving to RSA key pair (private and public keys in PEM format) or error details
   */
  async generateKeyPair(
    request: GenerateKeyPairRequest,
  ): Promise<Result<RSAKeyPair, ErrorWithMetadata>> {
    return this.actions.generateKeyPair(this.context, request);
  }

  /**
   * Encodes a JWT claim into a signed token string using RSA private key.
   * @param request - Encoding request object
   * @param request.correlationId - Unique identifier for tracking this operation across logs
   * @param request.claim - JWT claim object to encode
   * @param request.privateKey - RSA private key in PEM format for signing
   * @returns Promise resolving to signed JWT token string or error details
   */
  async encodeJWT(
    request: EncodeTokenRequest,
  ): Promise<Result<string, ErrorWithMetadata>> {
    return this.actions.encodeToken(this.context, request);
  }

  /**
   * Decodes and verifies a JWT token string using RSA public key.
   * @param request - Decoding request object
   * @param request.correlationId - Unique identifier for tracking this operation across logs
   * @param request.token - Signed JWT token string to decode
   * @param request.publicKey - RSA public key in PEM format for verification
   * @returns Promise resolving to verified JWT claim object or error details
   */
  async decodeJWT(
    request: DecodeTokenRequest,
  ): Promise<Result<JWTClaim, ErrorWithMetadata>> {
    return this.actions.decodeToken(this.context, request);
  }
}
