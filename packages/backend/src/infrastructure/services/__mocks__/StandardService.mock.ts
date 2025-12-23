import { mock } from 'bun:test';
import type { StandardService } from '@backend/infrastructure/services/StandardService';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { ExtractMockMethods } from '@core/types';

/**
 * Creates mocked methods for StandardService base class.
 * This provides the common CRUD operations that all services inherit.
 *
 * @returns Object containing mocked versions of StandardService methods
 */
export function getMockedStandardService<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
>(): ExtractMockMethods<StandardService<ID, T>> {
  return {
    serviceName: 'MockedStandardService',
    get: mock(),
    all: mock(),
    create: mock(),
    update: mock(),
    delete: mock(),
  };
}
