import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

import type { GCPAccessToken } from './GCPAuthClient';

/**
 * A function that fetches a GCP access token.
 * Each auth mechanism creates its own token fetcher.
 */
export type TokenFetcher = () => Promise<Result<GCPAccessToken, AppError>>;

/**
 * Result of initializing an auth mechanism.
 * Contains the project ID and a token fetcher function.
 */
export interface TokenFetcherResult {
  readonly projectId: string;
  readonly tokenFetcher: TokenFetcher;
}
