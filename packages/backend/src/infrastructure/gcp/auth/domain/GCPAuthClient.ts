import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';
import zod from 'zod';

// ============================================================================
// Access Token Schema
// ============================================================================

/**
 * Zod schema for GCP access token.
 */
export const gcpAccessTokenSchema = zod.strictObject({
  token: zod.string().min(1).describe('The access token'),
  expiresAt: zod.date().describe('Token expiration time'),
  tokenType: zod.literal('Bearer').describe('Token type'),
});

/**
 * GCP access token type.
 */
export type GCPAccessToken = Readonly<zod.infer<typeof gcpAccessTokenSchema>>;

// ============================================================================
// Auth Client Interface
// ============================================================================

/**
 * GCP authentication client interface.
 * Provides access tokens and auth headers for GCP API calls.
 * Does NOT expose the underlying google-auth-library client.
 */
export type IGCPAuthClient = Readonly<{
  /**
   * Get a valid access token.
   * Handles token refresh automatically if a refresh token is available.
   * Returns cached token if still valid.
   */
  getAccessToken(): Promise<Result<GCPAccessToken, AppError>>;

  /**
   * Get authorization headers for HTTP requests.
   * Convenience method that returns { Authorization: 'Bearer <token>' }
   */
  getAuthHeaders(): Promise<Result<Record<string, string>, AppError>>;

  /**
   * Project ID derived from credentials or explicitly provided.
   */
  readonly projectId: string;
}>;
