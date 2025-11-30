import { afterAll, beforeAll, beforeEach } from 'bun:test';
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import { getMockedLogger } from '@backend/infrastructure/logger/__mocks__/Logger.mock';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import { TestCache } from '@backend/testing/integration/setup/TestCache';
import { createTestConfig } from '@backend/testing/integration/setup/TestConfig';
import { TestDatabase } from '@backend/testing/integration/setup/TestDatabase';
import { TestServices } from '@backend/testing/integration/setup/TestServices';

/**
 * Base integration test context.
 *
 * Provides access to test configuration, logger, database, and cache.
 * For HTTP integration testing, use setupHttpIntegrationTest() from httpIntegrationTest.ts instead.
 */
export interface IntegrationTestContext {
  /**
   * Returns the test configuration service.
   */
  getConfig: () => IAppConfigurationService;

  /**
   * Returns the test logger instance.
   */
  getLogger: () => ILogger;
}

export function setupIntegrationTest(): IntegrationTestContext {
  let database: TestDatabase;
  let cache: TestCache;
  let config: IAppConfigurationService;
  let logger: ILogger;

  beforeAll(async () => {
    const databaseUrl = TestServices.getDatabaseUrl();
    const redisUrl = TestServices.getRedisUrl();

    database = new TestDatabase(databaseUrl);
    await database.initialize();

    config = createTestConfig({ databaseUrl, redisUrl });
    logger = getMockedLogger();

    cache = new TestCache(redisUrl);
    await cache.initialize();
  });

  beforeEach(async () => {
    await database.truncateAll();
    await cache.flushAll();
  });

  afterAll(async () => {
    if (cache) {
      await cache.close();
    }
    if (database) {
      await database.close();
    }
  });

  return {
    getConfig: () => config,
    getLogger: () => logger,
  };
}
