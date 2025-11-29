import type { ILogger } from '@backend/logger/Logger';
import type { CorrelationId } from '@core/domain/CorrelationId';
import type { JWTClaim } from '@core/domain/jwt/JWTClaim';
import type { Permission } from '@core/domain/permissions/permissions';
import type { UserId } from '@core/domain/user/user';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { ExtractMethods } from '@core/types';
import { err, type Result } from 'neverthrow';
import { type CreateClaimRequest, createClaim } from './actions/createClaim';
import { type DecodeClaimRequest, decodeClaim } from './actions/decodeClaim';
import { type EncodeClaimRequest, encodeClaim } from './actions/encodeClaim';
import { extractPermissions } from './actions/extractPermissions';
import { extractUserId } from './actions/extractUserId';
import {
  type GenerateKeyPairRequest,
  generateKeyPair,
  type JWTKeyPair,
} from './actions/generateKeyPair';
import {
  type ValidateClaimRequest,
  validateClaim,
} from './actions/validateClaim';

export type IJWTService = ExtractMethods<JWTService>;

export function createJWTService(ctx: JWTServiceContext): IJWTService {
  return new JWTService(ctx);
}

interface JWTServiceContext {
  logger: ILogger;
}

/**
 * Service for JWT token operations using RS256 (RSA) signature algorithm.
 * Provides secure token creation, encoding, decoding, and validation with correlation ID tracking.
 */
export class JWTService {
  constructor(
    private readonly context: JWTServiceContext,
    private readonly actions = {
      createClaim,
      encodeClaim,
      decodeClaim,
      validateClaim,
      generateKeyPair,
      extractUserId,
      extractPermissions,
    },
  ) {}

  /**
   * Creates a JWT claim structure from user ID and permissions.
   * Note: This method still requires appConfig context for environment-based permission logic.
   * In local environment, grants all permissions and sets expiration time.
   * In production, uses provided permissions without expiration.
   * @param request - Claim creation request object
   * @param request.correlationId - Unique identifier for tracking this operation across logs
   * @param request.userId - ID of the user for the JWT subject (sub)
   * @param request.permissions - Array of permissions for the JWT audience (aud)
   * @param request.expirationTime - Optional expiration time in seconds (default: 24 hours)
   * @param request.appConfig - App configuration service for environment detection
   * @returns JWT claim object or error details
   */
  create(
    request: CreateClaimRequest & {
      appConfig: () => import('@backend/services/configuration/AppConfigurationService').IAppConfigurationService;
    },
  ): Result<JWTClaim, ErrorWithMetadata> {
    return this.actions.createClaim(
      {
        logger: this.context.logger,
        appConfig: request.appConfig,
      },
      request,
    );
  }

  /**
   * Encodes a JWT claim into a signed token string using RSA private key.
   * @param request - Encoding request object
   * @param request.correlationId - Unique identifier for tracking this operation across logs
   * @param request.claim - JWT claim object to encode
   * @param request.privateKey - RSA private key in PEM format for signing
   * @returns Promise resolving to signed JWT token string or error details
   */
  async encode(
    request: EncodeClaimRequest,
  ): Promise<Result<string, ErrorWithMetadata>> {
    return this.actions.encodeClaim(this.context, request);
  }

  /**
   * Decodes and verifies a JWT token string using RSA public key.
   * @param request - Decoding request object
   * @param request.correlationId - Unique identifier for tracking this operation across logs
   * @param request.token - Signed JWT token string to decode
   * @param request.publicKey - RSA public key in PEM format for verification
   * @returns Promise resolving to verified JWT claim object or error details
   */
  async decode(
    request: DecodeClaimRequest,
  ): Promise<Result<JWTClaim, ErrorWithMetadata>> {
    return this.actions.decodeClaim(this.context, request);
  }

  /**
   * Validates a JWT claim structure, expiration, and required permissions.
   * @param request - Validation request object
   * @param request.correlationId - Unique identifier for tracking this operation across logs
   * @param request.claim - JWT claim object to validate
   * @param request.requiredPermissions - Optional array of permissions that must be present in claim
   * @returns Validated JWT claim or error details
   */
  validate(request: ValidateClaimRequest): Result<JWTClaim, ErrorWithMetadata> {
    return this.actions.validateClaim(this.context, request);
  }

  /**
   * Generates a new RSA key pair for JWT signing and verification.
   * Uses RS256 algorithm with extractable keys.
   * @param request - Key generation request object
   * @param request.correlationId - Unique identifier for tracking this operation across logs
   * @returns Promise resolving to RSA key pair (private and public keys in PEM format) or error details
   */
  async generateKeys(
    request: GenerateKeyPairRequest,
  ): Promise<Result<JWTKeyPair, ErrorWithMetadata>> {
    return this.actions.generateKeyPair(this.context, request);
  }

  /**
   * Extracts user ID from JWT claim subject field.
   * @param claim - JWT claim object
   * @returns User ID extracted from claim or error details
   */
  getUserId(claim: JWTClaim): Result<UserId, ErrorWithMetadata> {
    return this.actions.extractUserId(claim);
  }

  /**
   * Extracts and validates permissions from JWT claim audience field.
   * Filters out any invalid permission values.
   * @param claim - JWT claim object
   * @returns Array of valid permissions or error details
   */
  getPermissions(claim: JWTClaim): Result<Permission[], ErrorWithMetadata> {
    return this.actions.extractPermissions(claim);
  }

  /**
   * Convenience method that creates a JWT claim and immediately encodes it to a token.
   * @param params - Combined parameters for claim creation and encoding
   * @param params.correlationId - Unique identifier for tracking this operation across logs
   * @param params.userId - ID of the user for the JWT subject
   * @param params.permissions - Array of permissions for the JWT audience
   * @param params.expirationTime - Optional expiration time in seconds
   * @param params.privateKey - RSA private key in PEM format for signing
   * @param params.appConfig - App configuration service for environment detection
   * @returns Promise resolving to signed JWT token string or error details
   */
  async createAndEncode({
    correlationId,
    userId,
    permissions,
    expirationTime,
    privateKey,
    appConfig,
  }: {
    correlationId?: CorrelationId;
    userId: UserId;
    permissions: Permission[];
    expirationTime?: number;
    privateKey: string;
    appConfig: () => import('@backend/services/configuration/AppConfigurationService').IAppConfigurationService;
  }): Promise<Result<string, ErrorWithMetadata>> {
    const claimResult = this.create({
      correlationId,
      userId,
      permissions,
      expirationTime,
      appConfig,
    });

    if (claimResult.isErr()) {
      return err(claimResult.error);
    }

    return this.encode({ correlationId, claim: claimResult.value, privateKey });
  }

  /**
   * Convenience method that decodes a JWT token and validates it in one operation.
   * @param params - Combined parameters for decoding and validation
   * @param params.correlationId - Unique identifier for tracking this operation across logs
   * @param params.token - Signed JWT token string to decode and validate
   * @param params.publicKey - RSA public key in PEM format for verification
   * @param params.requiredPermissions - Optional array of permissions that must be present
   * @returns Promise resolving to validated JWT claim or error details
   */
  async decodeAndValidate({
    correlationId,
    token,
    publicKey,
    requiredPermissions,
  }: {
    correlationId?: CorrelationId;
    token: string;
    publicKey: string;
    requiredPermissions?: Permission[];
  }): Promise<Result<JWTClaim, ErrorWithMetadata>> {
    const decodeResult = await this.decode({ correlationId, token, publicKey });

    if (decodeResult.isErr()) {
      return decodeResult;
    }

    return this.validate({
      correlationId,
      claim: decodeResult.value,
      requiredPermissions,
    });
  }
}
