import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import { createTokenFetcher } from '../actions/createTokenFetcher';
import type { GCPAccessToken, IGCPAuthClient } from '../domain/GCPAuthClient';
import type { GCPAuthMechanism } from '../domain/GCPAuthMechanism';
import type { TokenFetcher } from '../domain/TokenFetcher';

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a GCP auth client for the given mechanism and scopes.
 * This function is infallible - validation happens before calling this.
 *
 * @param mechanism - The auth mechanism to use
 * @param scopes - The scopes to request (for service_account/adc only)
 * @param logger - Logger instance
 * @returns IGCPAuthClient instance (frozen)
 *
 * @example
 * ```typescript
 * const authClient = createGCPAuthClient(
 *   { type: 'service_account', credentials },
 *   ['https://www.googleapis.com/auth/devstorage.read_write'],
 *   logger,
 * );
 *
 * const tokenResult = await authClient.getAccessToken();
 * ```
 */
export function createGCPAuthClient(
  mechanism: GCPAuthMechanism,
  scopes: readonly string[],
  logger: ILogger,
): IGCPAuthClient {
  return Object.freeze(new GCPAuthClient(mechanism, scopes, logger));
}

// ============================================================================
// Dependencies Interface
// ============================================================================

interface GCPAuthClientDependencies {
  readonly createTokenFetcher: typeof createTokenFetcher;
}

// ============================================================================
// Implementation
// ============================================================================

class GCPAuthClient implements IGCPAuthClient {
  readonly projectId: string;
  private readonly tokenFetcher: TokenFetcher;

  constructor(
    mechanism: GCPAuthMechanism,
    scopes: readonly string[],
    logger: ILogger,
    dependencies: GCPAuthClientDependencies = {
      createTokenFetcher,
    },
  ) {
    const { projectId, tokenFetcher } = dependencies.createTokenFetcher(
      mechanism,
      scopes,
      logger,
    );
    this.projectId = projectId;
    this.tokenFetcher = tokenFetcher;
  }

  async getAccessToken(): Promise<Result<GCPAccessToken, AppError>> {
    return this.tokenFetcher();
  }

  async getAuthHeaders(): Promise<Result<Record<string, string>, AppError>> {
    const tokenResult = await this.getAccessToken();
    if (tokenResult.isErr()) {
      return err(tokenResult.error);
    }

    return ok({
      Authorization: `Bearer ${tokenResult.value.token}`,
    });
  }
}
