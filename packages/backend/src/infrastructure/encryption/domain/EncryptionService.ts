import type { CorrelationId } from '@core/domain/CorrelationId';
import type { JWTClaim } from '@core/domain/jwt/JWTClaim';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Result } from 'neverthrow';
import type { RSAKeyPair } from '../actions/rsa/generateKeyPair.ts';

export type IEncryptionService = Readonly<EncryptionService>;

interface EncryptionService {
  /**
   * Encrypts data using RSA public key with PKCS1 padding.
   */
  encryptRSA(request: {
    correlationId: CorrelationId;
    data: Buffer;
    publicKey: Buffer;
  }): Promise<Result<Buffer, ErrorWithMetadata>>;

  /**
   * Decrypts RSA-encrypted data using private key with PKCS1 padding.
   */
  decryptRSA(request: {
    correlationId: CorrelationId;
    data: Buffer;
    privateKey: Buffer;
  }): Promise<Result<Buffer, ErrorWithMetadata>>;

  /**
   * Generates cryptographically secure random salt for password hashing.
   */
  generateSalt(length?: number): string;

  /**
   * Generates a new RSA key pair for JWT signing and verification.
   */
  generateKeyPair(request: {
    correlationId?: CorrelationId;
  }): Promise<Result<RSAKeyPair, ErrorWithMetadata>>;

  /**
   * Encodes a JWT claim into a signed token string using RSA private key.
   */
  encodeJWT(request: {
    correlationId?: CorrelationId;
    claim: JWTClaim;
    privateKey: string;
  }): Promise<Result<string, ErrorWithMetadata>>;

  /**
   * Decodes and verifies a JWT token string using RSA public key.
   */
  decodeJWT(request: {
    correlationId?: CorrelationId;
    token: string;
    publicKey: string;
  }): Promise<Result<JWTClaim, ErrorWithMetadata>>;
}
