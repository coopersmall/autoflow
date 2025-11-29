import { beforeEach, describe, expect, it } from 'bun:test';
import { createDatabaseClientFactory } from '@backend/repos/clients/DatabaseClientFactory';
import { getMockedAppConfigurationService } from '@backend/services/configuration/__mocks__/AppConfigurationService.mock';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';

describe('DatabaseClientFactory', () => {
  let mockAppConfig: ReturnType<typeof getMockedAppConfigurationService>;
  const clientType = 'bun-sql';
  const tableName = 'test_table';
  const validPostgresUrl = 'postgres://user:pass@localhost:5432/testdb';

  beforeEach(() => {
    mockAppConfig = getMockedAppConfigurationService();
    mockAppConfig.databaseUrl = validPostgresUrl;
  });

  describe('getDatabase', () => {
    it('should create database client with valid database URL', () => {
      const factory = createDatabaseClientFactory(mockAppConfig);

      const result = factory.getDatabase(clientType, tableName);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBeDefined();
      }
    });

    it('should return error when database URL is not configured', () => {
      mockAppConfig.databaseUrl = undefined;
      const factory = createDatabaseClientFactory(mockAppConfig);

      const result = factory.getDatabase(clientType, tableName);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ErrorWithMetadata);
        expect(result.error.message).toContain('Database');
        expect(result.error.metadata.configKey).toBe('databaseUrl');
        expect(result.error.metadata.table).toBe(tableName);
      }
    });

    it('should return error when database URL is empty string', () => {
      mockAppConfig.databaseUrl = '';
      const factory = createDatabaseClientFactory(mockAppConfig);

      const result = factory.getDatabase(clientType, tableName);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Database');
      }
    });

    it('should include table name in error context', () => {
      mockAppConfig.databaseUrl = undefined;
      const factory = createDatabaseClientFactory(mockAppConfig);
      const customTable = 'users';

      const result = factory.getDatabase(clientType, customTable);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.metadata.table).toBe(customTable);
      }
    });

    it('should handle different valid Postgres URL formats', () => {
      const validUrls = [
        'postgres://localhost:5432/mydb',
        'postgresql://user:pass@localhost:5432/db',
        'postgres://localhost/db',
      ];

      validUrls.forEach((url) => {
        mockAppConfig.databaseUrl = url;
        const factory = createDatabaseClientFactory(mockAppConfig);

        const result = factory.getDatabase(clientType, tableName);

        expect(result.isOk()).toBe(true);
      });
    });

    it('should handle client creation gracefully', () => {
      mockAppConfig.databaseUrl = validPostgresUrl;
      const factory = createDatabaseClientFactory(mockAppConfig);

      const result = factory.getDatabase(clientType, tableName);

      expect(result.isOk()).toBe(true);
    });
  });

  describe('factory creation', () => {
    it('should create factory instance successfully', () => {
      const factory = createDatabaseClientFactory(mockAppConfig);

      expect(factory).toBeDefined();
    });

    it('should accept app config with all properties', () => {
      const factory = createDatabaseClientFactory(mockAppConfig);

      const result = factory.getDatabase(clientType, tableName);
      expect(result.isOk()).toBe(true);
    });
  });

  describe('error metadata', () => {
    it('should include configKey in metadata when database URL missing', () => {
      mockAppConfig.databaseUrl = undefined;
      const factory = createDatabaseClientFactory(mockAppConfig);

      const result = factory.getDatabase(clientType, tableName);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.metadata).toMatchObject({
          configKey: 'databaseUrl',
          table: tableName,
        });
      }
    });

    it('should include error details in metadata when config missing', () => {
      mockAppConfig.databaseUrl = undefined;
      const factory = createDatabaseClientFactory(mockAppConfig);

      const result = factory.getDatabase(clientType, tableName);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.metadata.configKey).toBe('databaseUrl');
        expect(result.error.metadata.table).toBe(tableName);
      }
    });

    it('should include table name in error metadata for different tables', () => {
      mockAppConfig.databaseUrl = undefined;
      const factory = createDatabaseClientFactory(mockAppConfig);
      const tables = ['users', 'products', 'orders'];

      tables.forEach((table) => {
        const result = factory.getDatabase(clientType, table);

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.metadata.table).toBe(table);
        }
      });
    });
  });

  describe('integration with Bun SQL client', () => {
    it('should return client with functional interface', () => {
      const factory = createDatabaseClientFactory(mockAppConfig);
      const result = factory.getDatabase(clientType, tableName);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const client = result.value;
        expect(typeof client).toBe('function');
      }
    });
  });

  describe('multiple table support', () => {
    it('should create clients for different tables', () => {
      const factory = createDatabaseClientFactory(mockAppConfig);
      const tables = ['users', 'posts', 'comments'];

      const results = tables.map((table) =>
        factory.getDatabase(clientType, table),
      );

      results.forEach((result) => {
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value).toBeDefined();
        }
      });
    });

    it('should return errors with correct table context for each table', () => {
      mockAppConfig.databaseUrl = undefined;
      const factory = createDatabaseClientFactory(mockAppConfig);
      const tables = ['users', 'products', 'orders'];

      tables.forEach((table) => {
        const result = factory.getDatabase(clientType, table);

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.metadata.table).toBe(table);
        }
      });
    });
  });
});
