import { mock } from 'bun:test';
import type { IRelationalDatabaseAdapter } from '@backend/infrastructure/repos/domain/DatabaseAdapter';
import type { ExtractMockMethods } from '@core/types';

export function getMockedRelationalDatabaseAdapter(): ExtractMockMethods<IRelationalDatabaseAdapter> {
  return {
    findUnique: mock(),
    findMany: mock(),
    create: mock(),
    update: mock(),
    delete: mock(),
    getClient: mock(),
  };
}
