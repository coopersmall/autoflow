import type { ISharedCache } from '@backend/infrastructure/cache/SharedCache';
import type { Context } from '@backend/infrastructure/context';
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
import type { AppError } from '@core/errors/AppError';
import type { ExtractMethods } from '@core/types';
import type { Result } from 'neverthrow';

export type ISharedService<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> = ExtractMethods<SharedService<ID, T>>;

interface SharedServiceConfig<
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
    private readonly config: SharedServiceConfig<ID, T>,
    private readonly sharedServiceActions: SharedServiceActions = {
      getItem,
      getAllItems,
      createItem,
      updateItem,
      deleteItem,
    },
  ) {}

  async get(ctx: Context, id: ID): Promise<Result<T, AppError>> {
    return this.sharedServiceActions.getItem(
      ctx,
      { id },
      {
        logger: this.config.logger,
        repo: this.repo,
        cache: this.cache,
        serviceName: this.serviceName,
      },
    );
  }

  async all(ctx: Context): Promise<Result<T[], AppError>> {
    return this.sharedServiceActions.getAllItems(ctx, {
      repo: this.repo,
    });
  }

  async create(
    ctx: Context,
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Result<T, AppError>> {
    return this.sharedServiceActions.createItem(
      ctx,
      { data },
      {
        logger: this.config.logger,
        repo: this.repo,
        cache: this.cache,
        serviceName: this.serviceName,
        newId: this.config.newId,
      },
    );
  }

  async update(
    ctx: Context,
    id: ID,
    data: Partial<T>,
  ): Promise<Result<T, AppError>> {
    return this.sharedServiceActions.updateItem(
      ctx,
      { id, data },
      {
        logger: this.config.logger,
        repo: this.repo,
        cache: this.cache,
        serviceName: this.serviceName,
      },
    );
  }

  async delete(ctx: Context, id: ID): Promise<Result<T, AppError>> {
    return this.sharedServiceActions.deleteItem(
      ctx,
      { id },
      {
        logger: this.config.logger,
        repo: this.repo,
        cache: this.cache,
        serviceName: this.serviceName,
      },
    );
  }

  protected get cache() {
    return this.config.cache?.();
  }

  protected get repo() {
    return this.config.repo();
  }
}
