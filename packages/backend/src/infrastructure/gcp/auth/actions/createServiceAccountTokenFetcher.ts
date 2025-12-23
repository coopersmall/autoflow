import type { ILogger } from '@backend/infrastructure/logger/Logger';
import { JWT } from 'google-auth-library';
import { err, ok } from 'neverthrow';

import { gcpAuthFailed } from '../../errors/gcpErrors';
import type { ServiceAccountMechanism } from '../domain/GCPAuthMechanism';
import type { TokenFetcherResult } from '../domain/TokenFetcher';

const DEFAULT_TOKEN_EXPIRY_MS = 3600 * 1000; // 1 hour

/**
 * Creates a token fetcher for service account authentication.
 *
 * @param mechanism - The service account mechanism with credentials
 * @param scopes - The scopes to request
 * @param logger - Logger instance
 * @returns TokenFetcherResult with project ID and fetcher function
 *
 * @example
 * ```typescript
 * const { projectId, tokenFetcher } = createServiceAccountTokenFetcher(
 *   { type: 'service_account', credentials },
 *   ['https://www.googleapis.com/auth/devstorage.read_write'],
 *   logger,
 * );
 * ```
 */
export function createServiceAccountTokenFetcher(
  mechanism: ServiceAccountMechanism,
  scopes: readonly string[],
  logger: ILogger,
  dependencies = { createJWT },
): TokenFetcherResult {
  const { credentials } = mechanism;

  const jwtClient = dependencies.createJWT(
    credentials.client_email,
    credentials.private_key,
    scopes,
  );

  const tokenFetcher = async () => {
    try {
      const tokenResponse = await jwtClient.getAccessToken();
      const token = tokenResponse.token;
      const expiryDate = jwtClient.credentials.expiry_date;

      if (!token) {
        return err(
          gcpAuthFailed('Failed to obtain access token from service account', {
            mechanism: 'service_account',
            projectId: credentials.project_id,
          }),
        );
      }

      return ok({
        token,
        expiresAt: expiryDate
          ? new Date(expiryDate)
          : new Date(Date.now() + DEFAULT_TOKEN_EXPIRY_MS),
        tokenType: 'Bearer' as const,
      });
    } catch (e) {
      logger.error('GCP service account auth failed', e, {
        mechanism: 'service_account',
        projectId: credentials.project_id,
      });
      return err(
        gcpAuthFailed('Service account authentication failed', {
          cause: e,
          mechanism: 'service_account',
          projectId: credentials.project_id,
        }),
      );
    }
  };

  return {
    projectId: credentials.project_id,
    tokenFetcher,
  };
}

function createJWT(email: string, key: string, scopes: readonly string[]): JWT {
  return new JWT({
    email,
    key,
    scopes: [...scopes],
  });
}
