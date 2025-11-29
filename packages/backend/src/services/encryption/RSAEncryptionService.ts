import type { ILogger } from '@backend/logger/Logger';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { ExtractMethods } from '@core/types';
import type { Result } from 'neverthrow';
import { type DecryptRSARequest, decryptRSA } from './actions/decryptRSA';
import { type EncryptRSARequest, encryptRSA } from './actions/encryptRSA';
import { generateSalt } from './actions/generateSalt';

export type IRSAEncryptionService = ExtractMethods<RSAEncryptionService>;

export function createRSAEncryptionService(
  ctx: RSAEncryptionServiceContext,
): IRSAEncryptionService {
  return new RSAEncryptionService(ctx);
}

interface RSAEncryptionServiceContext {
  logger: ILogger;
}

/**
 * Service for RSA encryption and decryption operations using PKCS1 padding.
 * Provides secure cryptographic operations with correlation ID tracking and error handling.
 */
export class RSAEncryptionService {
  constructor(
    private readonly context: RSAEncryptionServiceContext,
    private readonly actions = {
      encrypt: encryptRSA,
      decrypt: decryptRSA,
      generateSalt,
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
  async encrypt(
    request: EncryptRSARequest,
  ): Promise<Result<Buffer, ErrorWithMetadata>> {
    return this.actions.encrypt(this.context, request);
  }

  /**
   * Decrypts RSA-encrypted data using private key with PKCS1 padding.
   * @param request - Decryption request object
   * @param request.correlationId - Unique identifier for tracking this operation across logs
   * @param request.data - Encrypted binary data buffer to be decrypted
   * @param request.privateKey - RSA private key in PEM format as buffer
   * @returns Promise resolving to decrypted data buffer or error details
   */
  async decrypt(
    request: DecryptRSARequest,
  ): Promise<Result<Buffer, ErrorWithMetadata>> {
    return this.actions.decrypt(this.context, request);
  }

  /**
   * Generates cryptographically secure random salt for password hashing.
   * @param length - Salt length in bytes, defaults to 32 bytes (64 hex characters)
   * @returns Hex-encoded random salt string
   */
  generateSalt(length?: number): string {
    return this.actions.generateSalt({ length });
  }
}
