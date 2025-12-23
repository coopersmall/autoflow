import type { ILogger } from '@backend/infrastructure/logger/Logger';
import { OAuth2Client } from 'google-auth-library';
import { err, ok } from 'neverthrow';

import { gcpAuthFailed, gcpTokenExpired } from '../../errors/gcpErrors';
import type { OAuth2Mechanism } from '../domain/GCPAuthMechanism';
import type { TokenFetcherResult } from '../domain/TokenFetcher';

const DEFAULT_TOKEN_EXPIRY_MS = 3600 * 1000; // 1 hour

/**
 * Creates a token fetcher for OAuth2 authentication.
 * OAuth2 tokens are pre-scoped by the caller.
 *
 * @param mechanism - The OAuth2 mechanism with access/refresh tokens
 * @param logger - Logger instance
 * @returns TokenFetcherResult with project ID and fetcher function
 *
 * @example
 * ```typescript
 * const { projectId, tokenFetcher } = createOAuth2TokenFetcher(
 *   { type: 'oauth2', accessToken, refreshToken, projectId },
 *   logger,
 * );
 * ```
 */
export function createOAuth2TokenFetcher(
  mechanism: OAuth2Mechanism,
  logger: ILogger,
  dependencies = { getOAuth2Client },
): TokenFetcherResult {
  const { accessToken, refreshToken, projectId } = mechanism;
  const oauth2Client = dependencies.getOAuth2Client(accessToken, refreshToken);

  const tokenFetcher = async () => {
    try {
      // If we have a refresh token, the library will auto-refresh
      // If not, we just return the current token
      const tokenResponse = await oauth2Client.getAccessToken();
      const token = tokenResponse.token;
      const expiryDate = oauth2Client.credentials.expiry_date;

      if (!token) {
        // Token expired and no refresh token available
        if (!refreshToken) {
          return err(
            gcpTokenExpired(
              'OAuth2 access token expired and no refresh token available',
              {
                mechanism: 'oauth2',
                projectId,
              },
            ),
          );
        }

        return err(
          gcpAuthFailed('Failed to obtain access token via OAuth2', {
            mechanism: 'oauth2',
            projectId,
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
      logger.error('GCP OAuth2 auth failed', e, {
        mechanism: 'oauth2',
        projectId,
        hasRefreshToken: !!refreshToken,
      });

      const errorMessage = e instanceof Error ? e.message : String(e);
      if (
        errorMessage.includes('invalid_grant') ||
        errorMessage.includes('Token has been expired')
      ) {
        return err(
          gcpTokenExpired('OAuth2 token expired or revoked', {
            cause: e,
            mechanism: 'oauth2',
            projectId,
          }),
        );
      }

      return err(
        gcpAuthFailed('OAuth2 authentication failed', {
          cause: e,
          mechanism: 'oauth2',
          projectId,
        }),
      );
    }
  };

  return {
    projectId,
    tokenFetcher,
  };
}

interface IOAuth2Client {
  getAccessToken(): Promise<{ token?: string | null }>;
  credentials: {
    expiry_date?: number | null;
  };
}

function getOAuth2Client(
  accessToken: string,
  refreshToken?: string,
): IOAuth2Client {
  const client = new OAuth2Client();
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return client;
}
