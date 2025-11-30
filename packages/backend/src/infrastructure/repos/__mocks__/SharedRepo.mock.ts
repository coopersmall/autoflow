import { mock } from 'bun:test';
import type { ISharedRepo } from '@backend/infrastructure/repos/SharedRepo';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { ExtractMockMethods } from '@core/types';

export function getMockedSharedRepo<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
>(): ExtractMockMethods<ISharedRepo<ID, T>> {
  return {
    get: mock(),
    all: mock(),
    create: mock(),
    update: mock(),
    delete: mock(),
    getClient: mock(),
  };
}
