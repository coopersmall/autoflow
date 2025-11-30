import type { ISharedCache } from '@backend/infrastructure/cache/SharedCache';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { ISharedRepo } from '@backend/infrastructure/repos/SharedRepo';
import {
  createItem,
  deleteItem,
  getAllItems,
  getItem,
  updateItem,
} from '@backend/infrastructure/services/actions/shared';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { ExtractMethods } from '@core/types';
import type { Result } from 'neverthrow';

export type ISharedService<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> = ExtractMethods<SharedService<ID, T>>;

interface SharedServiceContext<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  readonly logger: ILogger;
  readonly newId: () => ID;
  readonly repo: () => ISharedRepo<ID, T>;
  readonly cache?: () => ISharedCache<ID, T>;
}

interface SharedServiceActions {
  getItem: typeof getItem;
  getAllItems: typeof getAllItems;
  createItem: typeof createItem;
  updateItem: typeof updateItem;
  deleteItem: typeof deleteItem;
}

export class SharedService<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> implements ISharedService<ID, T>
{
  constructor(
    readonly serviceName: string,
    private readonly sharedServiceCtx: SharedServiceContext<ID, T>,
    private readonly sharedServiceActions: SharedServiceActions = {
      getItem,
      getAllItems,
      createItem,
      updateItem,
      deleteItem,
    },
  ) {}

  async get(id: ID): Promise<Result<T, ErrorWithMetadata>> {
    return this.sharedServiceActions.getItem(
      {
        logger: this.sharedServiceCtx.logger,
        repo: this.repo,
        cache: this.cache,
        serviceName: this.serviceName,
      },
      { id },
    );
  }

  async all(): Promise<Result<T[], ErrorWithMetadata>> {
    return this.sharedServiceActions.getAllItems({
      repo: this.repo,
    });
  }

  async create(
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Result<T, ErrorWithMetadata>> {
    return this.sharedServiceActions.createItem(
      {
        logger: this.sharedServiceCtx.logger,
        repo: this.repo,
        cache: this.cache,
        serviceName: this.serviceName,
        newId: this.sharedServiceCtx.newId,
      },
      { data },
    );
  }

  async update(
    id: ID,
    data: Partial<T>,
  ): Promise<Result<T, ErrorWithMetadata>> {
    return this.sharedServiceActions.updateItem(
      {
        logger: this.sharedServiceCtx.logger,
        repo: this.repo,
        cache: this.cache,
        serviceName: this.serviceName,
      },
      { id, data },
    );
  }

  async delete(id: ID): Promise<Result<T, ErrorWithMetadata>> {
    return this.sharedServiceActions.deleteItem(
      {
        logger: this.sharedServiceCtx.logger,
        repo: this.repo,
        cache: this.cache,
        serviceName: this.serviceName,
      },
      { id },
    );
  }

  protected get cache() {
    return this.sharedServiceCtx.cache?.();
  }

  protected get repo() {
    return this.sharedServiceCtx.repo();
  }
}
