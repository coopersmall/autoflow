import { ok } from 'neverthrow';
import type { TestMechanism } from '../domain/GCPAuthMechanism';
import type { TokenFetcherResult } from '../domain/TokenFetcher';

/**
 * Creates a dummy token fetcher for integration testing with GCS emulator.
 *
 * The GCS emulator does not validate authentication, so this returns
 * a fake token that will be ignored.
 *
 * WARNING: Only use in test environments.
 */
export function createTestTokenFetcher(
  mechanism: TestMechanism,
): TokenFetcherResult {
  return {
    projectId: mechanism.projectId,
    tokenFetcher: async () =>
      ok({
        token: 'test-token',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        tokenType: 'Bearer',
      }),
  };
}
