import { mock } from 'bun:test';
import type { SharedService } from '@backend/infrastructure/services/SharedService';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { ExtractMockMethods } from '@core/types';

/**
 * Creates mocked methods for Shared base class.
 * This provides the common CRUD operations that all services inherit.
 *
 * @returns Object containing mocked versions of SharedService methods
 */
export function getMockedSharedService<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
>(): ExtractMockMethods<SharedService<ID, T>> {
  return {
    serviceName: 'MockedStandardService',
    get: mock(),
    all: mock(),
    create: mock(),
    update: mock(),
    delete: mock(),
  };
}
