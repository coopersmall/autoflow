import type { Context } from '@backend/infrastructure/context';
import type { JWTClaim } from '@core/domain/jwt/JWTClaim';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';
import type { RSAKeyPair } from '../actions/rsa/generateKeyPair.ts';

export type IEncryptionService = Readonly<EncryptionService>;

interface EncryptionService {
  /**
   * Encrypts data using RSA public key with PKCS1 padding.
   */
  encryptRSA(
    ctx: Context,
    request: {
      data: Buffer;
      publicKey: Buffer;
    },
  ): Promise<Result<Buffer, AppError>>;

  /**
   * Decrypts RSA-encrypted data using private key with PKCS1 padding.
   */
  decryptRSA(
    ctx: Context,
    request: {
      data: Buffer;
      privateKey: Buffer;
    },
  ): Promise<Result<Buffer, AppError>>;

  /**
   * Generates cryptographically secure random salt for password hashing.
   */
  generateSalt(length?: number): string;

  /**
   * Generates a new RSA key pair for JWT signing and verification.
   */
  generateKeyPair(ctx: Context): Promise<Result<RSAKeyPair, AppError>>;

  /**
   * Encodes a JWT claim into a signed token string using RSA private key.
   */
  encodeJWT(
    ctx: Context,
    request: {
      claim: JWTClaim;
      privateKey: string;
    },
  ): Promise<Result<string, AppError>>;

  /**
   * Decodes and verifies a JWT token string using RSA public key.
   */
  decodeJWT(
    ctx: Context,
    request: {
      token: string;
      publicKey: string;
    },
  ): Promise<Result<JWTClaim, AppError>>;
}
