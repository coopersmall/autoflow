/**
 * HTTP integration testing setup.
 *
 * Provides a complete integration test environment with HTTP server, client,
 * authentication, database, and cache capabilities. This is a self-contained
 * setup that manages all test infrastructure in a single set of hooks.
 *
 * IMPORTANT: This setup is intentionally NOT built on top of setupIntegrationTest()
 * to avoid issues with multiple nested hook registrations when multiple HTTP test
 * files run together. Each HTTP test file gets its own isolated hook registrations.
 *
 * Usage:
 * ```typescript
 * import { setupHttpIntegrationTest } from '@backend/testing/integration/httpIntegrationTest';
 *
 * describe('MyHttpHandler Tests', () => {
 *   const { getHttpServer, getHttpClient, getTestAuth, getConfig, getLogger } =
 *     setupHttpIntegrationTest();
 *
 *   beforeAll(async () => {
 *     const config = getConfig();
 *     const logger = getLogger();
 *     const serviceFactory = createServiceFactory({ logger });
 *
 *     const handlers = [
 *       createMyHandler({
 *         logger,
 *         appConfig: config,
 *         service: serviceFactory.getService('myService'),
 *       }),
 *     ];
 *
 *     await getHttpServer().start(handlers);
 *   });
 *
 *   it('should handle requests', async () => {
 *     const client = getHttpClient();
 *     const auth = getTestAuth();
 *     const headers = await auth.createAdminHeaders();
 *     const response = await client.get('/api/resource', { headers });
 *     expect(response.status).toBe(200);
 *   });
 * });
 * ```
 */

import { afterAll, beforeAll, beforeEach } from 'bun:test';
import { getMockedLogger } from '@backend/logger/__mocks__/Logger.mock';
import type { ILogger } from '@backend/logger/Logger';
import type { IAppConfigurationService } from '@backend/services/configuration/AppConfigurationService';
import { createJWTService } from '@backend/services/jwt/JWTService';
import { TestAuth } from '@backend/testing/integration/setup/TestAuth';
import { TestCache } from '@backend/testing/integration/setup/TestCache';
import { createTestConfig } from '@backend/testing/integration/setup/TestConfig';
import { TestDatabase } from '@backend/testing/integration/setup/TestDatabase';
import { TestHttpClient } from '@backend/testing/integration/setup/TestHttpClient';
import { TestHttpServer } from '@backend/testing/integration/setup/TestHttpServer';
import { TestPortPool } from '@backend/testing/integration/setup/TestPortPool';
import { TestServices } from '@backend/testing/integration/setup/TestServices';

/**
 * HTTP integration test context with all testing capabilities.
 *
 * Includes server management, HTTP client, authentication helpers,
 * and access to configuration and logging.
 */
export interface HttpIntegrationTestContext {
  /**
   * Returns the test configuration service.
   */
  getConfig: () => IAppConfigurationService;

  /**
   * Returns the test logger instance.
   */
  getLogger: () => ILogger;

  /**
   * Returns the HTTP server instance for starting/stopping.
   * Note: Server must be started in test's beforeAll with handlers.
   *
   * @example
   * ```typescript
   * beforeAll(async () => {
   *   await getHttpServer().start(handlers);
   * });
   * ```
   */
  getHttpServer: () => TestHttpServer;

  /**
   * Returns the HTTP client for making requests.
   *
   * @example
   * ```typescript
   * const client = getHttpClient();
   * const response = await client.get('/api/users');
   * ```
   */
  getHttpClient: () => TestHttpClient;

  /**
   * Returns the test auth helper for generating JWT tokens.
   *
   * @example
   * ```typescript
   * const auth = getTestAuth();
   * const headers = await auth.createAdminHeaders();
   * ```
   */
  getTestAuth: () => TestAuth;
}

/**
 * Sets up HTTP integration testing environment.
 *
 * Creates a complete, self-contained test environment with:
 * - Database connection and per-test cleanup
 * - Redis cache connection and per-test cleanup
 * - HTTP server with unique port allocation
 * - HTTP client pointing to the test server
 * - Authentication helpers for JWT token generation
 *
 * Architecture:
 * - All hooks (beforeAll, beforeEach, afterAll) are registered in a single
 *   function call to avoid issues with nested hook registrations
 * - Acquires unique port from TestPortPool for parallel test execution
 * - Truncates database and flushes cache before each test for isolation
 *
 * @returns HTTP integration test context with server, client, auth, config, and logger
 *
 * @example
 * ```typescript
 * describe('UsersHttpHandler Tests', () => {
 *   const { getHttpServer, getHttpClient, getTestAuth, getConfig, getLogger } =
 *     setupHttpIntegrationTest();
 *
 *   beforeAll(async () => {
 *     const handlers = [createAPIUserHandlers(...)];
 *     await getHttpServer().start(handlers);
 *   });
 *
 *   it('should create user', async () => {
 *     const client = getHttpClient();
 *     const auth = getTestAuth();
 *     const headers = await auth.createAdminHeaders();
 *
 *     const response = await client.post(
 *       '/api/users',
 *       { schemaVersion: 1 },
 *       { headers }
 *     );
 *
 *     expect(response.status).toBe(201);
 *   });
 * });
 * ```
 */
export function setupHttpIntegrationTest(): HttpIntegrationTestContext {
  // All state variables for this test file's isolated environment
  let database: TestDatabase;
  let cache: TestCache;
  let config: IAppConfigurationService;
  let logger: ILogger;
  let httpServer: TestHttpServer;
  let httpClient: TestHttpClient;
  let testAuth: TestAuth;
  let port: number;

  beforeAll(async () => {
    // Initialize database and cache connections
    const databaseUrl = TestServices.getDatabaseUrl();
    const redisUrl = TestServices.getRedisUrl();

    database = new TestDatabase(databaseUrl);
    await database.initialize();

    config = createTestConfig({ databaseUrl, redisUrl });
    logger = getMockedLogger();

    cache = new TestCache(redisUrl);
    await cache.initialize();

    // Acquire unique port from pool for this test file
    port = TestPortPool.acquire();

    // Create HTTP server (will be started in test's beforeAll with handlers)
    httpServer = new TestHttpServer(port, logger);

    // Create HTTP client pointing to server
    httpClient = new TestHttpClient(httpServer.getBaseUrl());

    // Create auth helper with JWT service
    const jwtService = createJWTService({ logger });
    testAuth = new TestAuth(config, jwtService);
  });

  beforeEach(async () => {
    // Clean database and cache before each test for isolation
    await database.truncateAll();
    await cache.flushAll();
  });

  afterAll(async () => {
    // Stop HTTP server if running
    if (httpServer) {
      await httpServer.stop();
    }

    // Close database and cache connections
    if (cache) {
      await cache.close();
    }
    if (database) {
      await database.close();
    }

    // Do not release port back to pool to avoid conflicts in parallel tests
  });

  return {
    getConfig: () => config,
    getLogger: () => logger,
    getHttpServer: () => httpServer,
    getHttpClient: () => httpClient,
    getTestAuth: () => testAuth,
  };
}
