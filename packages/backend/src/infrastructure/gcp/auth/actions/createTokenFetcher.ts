import type { ILogger } from '@backend/infrastructure/logger/Logger';
import { unreachable } from '@core/unreachable';
import type { GCPAuthMechanism } from '../domain/GCPAuthMechanism';
import type { TokenFetcherResult } from '../domain/TokenFetcher';
import { createADCTokenFetcher } from './createADCTokenFetcher';
import { createOAuth2TokenFetcher } from './createOAuth2TokenFetcher';
import { createServiceAccountTokenFetcher } from './createServiceAccountTokenFetcher';

/**
 * Creates a token fetcher for the given auth mechanism.
 * Dispatches to the appropriate mechanism-specific action.
 *
 * @param mechanism - The auth mechanism to use
 * @param scopes - The scopes to request (for service_account/adc only)
 * @param logger - Logger instance
 * @returns TokenFetcherResult with project ID and fetcher function
 *
 * @example
 * ```typescript
 * const { projectId, tokenFetcher } = createTokenFetcher(
 *   { type: 'service_account', credentials },
 *   ['https://www.googleapis.com/auth/devstorage.read_write'],
 *   logger,
 * );
 *
 * const tokenResult = await tokenFetcher();
 * ```
 */
export function createTokenFetcher(
  mechanism: GCPAuthMechanism,
  scopes: readonly string[],
  logger: ILogger,
): TokenFetcherResult {
  switch (mechanism.type) {
    case 'service_account':
      return createServiceAccountTokenFetcher(mechanism, scopes, logger);
    case 'oauth2':
      return createOAuth2TokenFetcher(mechanism, logger);
    case 'adc':
      return createADCTokenFetcher(mechanism, scopes, logger);
    default:
      unreachable(mechanism);
  }
}
