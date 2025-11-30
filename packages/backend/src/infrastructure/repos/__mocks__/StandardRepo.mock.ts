import { mock } from 'bun:test';
import type { IStandardRepo } from '@backend/infrastructure/repos/StandardRepo';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { ExtractMockMethods } from '@core/types';

export function getMockedStandardRepo<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
>(): ExtractMockMethods<IStandardRepo<ID, T>> {
  return {
    get: mock(),
    all: mock(),
    create: mock(),
    update: mock(),
    delete: mock(),
    getClient: mock(),
  };
}
