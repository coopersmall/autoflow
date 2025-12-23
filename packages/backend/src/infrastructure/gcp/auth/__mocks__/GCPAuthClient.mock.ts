import { mock } from 'bun:test';
import type { ExtractMockMethods } from '@core/types';
import { ok } from 'neverthrow';

import type { GCPAccessToken, IGCPAuthClient } from '../domain/GCPAuthClient';

/**
 * Creates a mocked GCP Auth Client for unit testing.
 *
 * @param overrides - Optional partial overrides for the mock
 * @returns Mocked IGCPAuthClient with all methods as mock functions
 *
 * @example
 * ```typescript
 * const mockClient = getMockedGCPAuthClient();
 * mockClient.getAccessToken.mockResolvedValue(ok({
 *   token: 'test-token',
 *   expiresAt: new Date(),
 *   tokenType: 'Bearer',
 * }));
 *
 * const result = await mockClient.getAccessToken();
 * expect(mockClient.getAccessToken).toHaveBeenCalled();
 * ```
 */
export function getMockedGCPAuthClient(
  overrides?: Partial<ExtractMockMethods<IGCPAuthClient>>,
): ExtractMockMethods<IGCPAuthClient> {
  return {
    getAccessToken: mock(),
    getAuthHeaders: mock(),
    projectId: 'test-project-id',
    ...overrides,
  };
}

/**
 * Creates a test GCP access token for use in tests.
 *
 * @param overrides - Optional partial overrides for the token
 * @returns A complete GCPAccessToken
 */
export function createTestGCPAccessToken(
  overrides?: Partial<GCPAccessToken>,
): GCPAccessToken {
  return {
    token: 'test-access-token-12345',
    expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
    tokenType: 'Bearer',
    ...overrides,
  };
}

/**
 * Creates a mock that returns a successful access token.
 *
 * @param token - Optional token to return (uses default if not provided)
 * @returns Mock function that resolves to ok(token)
 */
export function mockSuccessfulAccessToken(token?: GCPAccessToken) {
  const mockToken = token ?? createTestGCPAccessToken();
  return mock().mockResolvedValue(ok(mockToken));
}
