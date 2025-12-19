import type { IStandardCache } from '@backend/infrastructure/cache/StandardCache';
import type { Context } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IStandardRepo } from '@backend/infrastructure/repos/StandardRepo';
import {
  createItem,
  deleteItem,
  getAllItems,
  getItem,
  updateItem,
} from '@backend/infrastructure/services/actions/standard';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import type { ExtractMethods } from '@core/types';
import type { Result } from 'neverthrow';

export type IStandardService<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> = ExtractMethods<StandardService<ID, T>>;

interface StandardServiceConfig<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  readonly logger: ILogger;
  readonly newId: () => ID;
  readonly cache?: () => IStandardCache<ID, T>;
  readonly repo: () => IStandardRepo<ID, T>;
}

interface StandardServiceActions {
  getItem: typeof getItem;
  getAllItems: typeof getAllItems;
  createItem: typeof createItem;
  updateItem: typeof updateItem;
  deleteItem: typeof deleteItem;
}

export class StandardService<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  constructor(
    readonly serviceName: string,
    private readonly config: StandardServiceConfig<ID, T>,
    private readonly standardServiceActions: StandardServiceActions = {
      getItem,
      getAllItems,
      createItem,
      updateItem,
      deleteItem,
    },
  ) {}

  async get(
    ctx: Context,
    id: ID,
    userId: UserId,
  ): Promise<Result<T, AppError>> {
    return this.standardServiceActions.getItem(
      ctx,
      { id, userId },
      {
        logger: this.config.logger,
        repo: this.repo,
        cache: this.cache,
        serviceName: this.serviceName,
      },
    );
  }

  async all(ctx: Context, userId: UserId): Promise<Result<T[], AppError>> {
    return this.standardServiceActions.getAllItems(
      ctx,
      { userId },
      {
        repo: this.repo,
      },
    );
  }

  async create(
    ctx: Context,
    userId: UserId,
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Result<T, AppError>> {
    return this.standardServiceActions.createItem(
      ctx,
      { userId, data },
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
    userId: UserId,
    data: Partial<T>,
  ): Promise<Result<T, AppError>> {
    return this.standardServiceActions.updateItem(
      ctx,
      { id, userId, data },
      {
        logger: this.config.logger,
        repo: this.repo,
        cache: this.cache,
        serviceName: this.serviceName,
      },
    );
  }

  async delete(
    ctx: Context,
    id: ID,
    userId: UserId,
  ): Promise<Result<T, AppError>> {
    return this.standardServiceActions.deleteItem(
      ctx,
      { id, userId },
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
