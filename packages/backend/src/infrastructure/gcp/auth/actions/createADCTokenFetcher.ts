import type { ILogger } from '@backend/infrastructure/logger/Logger';
import { type AnyAuthClient, GoogleAuth } from 'google-auth-library';
import { err, ok } from 'neverthrow';

import { gcpAuthFailed } from '../../errors/gcpErrors';
import type { ADCMechanism } from '../domain/GCPAuthMechanism';
import type { TokenFetcherResult } from '../domain/TokenFetcher';

const DEFAULT_TOKEN_EXPIRY_MS = 3600 * 1000; // 1 hour

/**
 * Creates a token fetcher for Application Default Credentials.
 * Project ID can be derived from the environment if not provided.
 *
 * @param mechanism - The ADC mechanism with optional project ID
 * @param scopes - The scopes to request
 * @param logger - Logger instance
 * @returns TokenFetcherResult with project ID and fetcher function
 *
 * @example
 * ```typescript
 * const { projectId, tokenFetcher } = createADCTokenFetcher(
 *   { type: 'adc', projectId: 'my-project' },
 *   ['https://www.googleapis.com/auth/devstorage.read_write'],
 *   logger,
 * );
 * ```
 */
export function createADCTokenFetcher(
  mechanism: ADCMechanism,
  scopes: readonly string[],
  logger: ILogger,
  dependencies = { createGoogleAuthInstance },
): TokenFetcherResult {
  const googleAuth = dependencies.createGoogleAuthInstance(
    scopes,
    mechanism.projectId,
  );

  // We'll derive the project ID on first token fetch if not provided
  let cachedProjectId = mechanism.projectId ?? '';

  const tokenFetcher = async () => {
    try {
      const client = await googleAuth.getClient();
      const tokenResponse = await client.getAccessToken();
      const token = tokenResponse.token;

      if (!token) {
        return err(
          gcpAuthFailed('Failed to obtain access token via ADC', {
            mechanism: 'adc',
            projectId: cachedProjectId || undefined,
          }),
        );
      }

      // Try to get project ID if not already cached
      if (!cachedProjectId) {
        try {
          const derivedProjectId = await googleAuth.getProjectId();
          if (derivedProjectId) {
            cachedProjectId = derivedProjectId;
          }
        } catch {
          // Project ID derivation failed, but we can continue
          logger.debug('Could not derive project ID from ADC');
        }
      }

      // Get expiry from credentials if available
      const credentials = client.credentials;
      const expiryDate = credentials.expiry_date;

      return ok({
        token,
        expiresAt: expiryDate
          ? new Date(expiryDate)
          : new Date(Date.now() + DEFAULT_TOKEN_EXPIRY_MS),
        tokenType: 'Bearer' as const,
      });
    } catch (e) {
      logger.error('GCP ADC auth failed', e, {
        mechanism: 'adc',
        projectId: cachedProjectId || undefined,
      });
      return err(
        gcpAuthFailed('Application Default Credentials authentication failed', {
          cause: e,
          mechanism: 'adc',
          projectId: cachedProjectId || undefined,
        }),
      );
    }
  };

  return {
    projectId: cachedProjectId,
    tokenFetcher,
  };
}

interface IGoogleAuth {
  getClient(): Promise<AnyAuthClient>;
  getProjectId(): Promise<string | null>;
}

function createGoogleAuthInstance(
  scopes: readonly string[],
  projectId?: string,
): IGoogleAuth {
  return new GoogleAuth({
    scopes: [...scopes],
    projectId,
  });
}
