import type { IStandardCache } from '@backend/infrastructure/cache/StandardCache';
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
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { ExtractMethods } from '@core/types';
import type { Result } from 'neverthrow';

export type IStandardService<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> = ExtractMethods<StandardService<ID, T>>;

interface StandardServiceContext<
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
    private readonly standardServiceCtx: StandardServiceContext<ID, T>,
    private readonly standardServiceActions: StandardServiceActions = {
      getItem,
      getAllItems,
      createItem,
      updateItem,
      deleteItem,
    },
  ) {}

  async get(id: ID, userId: UserId): Promise<Result<T, ErrorWithMetadata>> {
    return this.standardServiceActions.getItem(
      {
        logger: this.standardServiceCtx.logger,
        repo: this.repo,
        cache: this.cache,
        serviceName: this.serviceName,
      },
      { id, userId },
    );
  }

  async all(userId: UserId): Promise<Result<T[], ErrorWithMetadata>> {
    return this.standardServiceActions.getAllItems(
      {
        repo: this.repo,
      },
      { userId },
    );
  }

  async create(
    userId: UserId,
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Result<T, ErrorWithMetadata>> {
    return this.standardServiceActions.createItem(
      {
        logger: this.standardServiceCtx.logger,
        repo: this.repo,
        cache: this.cache,
        serviceName: this.serviceName,
        newId: this.standardServiceCtx.newId,
      },
      { userId, data },
    );
  }

  async update(
    id: ID,
    userId: UserId,
    data: Partial<T>,
  ): Promise<Result<T, ErrorWithMetadata>> {
    return this.standardServiceActions.updateItem(
      {
        logger: this.standardServiceCtx.logger,
        repo: this.repo,
        cache: this.cache,
        serviceName: this.serviceName,
      },
      { id, userId, data },
    );
  }

  async delete(id: ID, userId: UserId): Promise<Result<T, ErrorWithMetadata>> {
    return this.standardServiceActions.deleteItem(
      {
        logger: this.standardServiceCtx.logger,
        repo: this.repo,
        cache: this.cache,
        serviceName: this.serviceName,
      },
      { id, userId },
    );
  }

  protected get cache() {
    return this.standardServiceCtx.cache?.();
  }

  protected get repo() {
    return this.standardServiceCtx.repo();
  }
}
