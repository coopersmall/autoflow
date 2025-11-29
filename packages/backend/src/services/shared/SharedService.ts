import type { ISharedCache } from '@backend/cache/SharedCache';
import type { ILogger } from '@backend/logger/Logger';
import type { ISharedRepo } from '@backend/repos/SharedRepo';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { ExtractMethods } from '@core/types';
import { err, ok, type Result } from 'neverthrow';

export type ISharedService<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> = ExtractMethods<SharedService<ID, T>>;

interface SharedServiceContext<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  logger: ILogger;
  newId: () => ID;
  repo: () => ISharedRepo<ID, T>;
  cache?: () => ISharedCache<ID, T>;
}

export class SharedService<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  constructor(
    readonly serviceName: string,
    private readonly sharedServiceCtx: SharedServiceContext<ID, T>,
  ) {}

  async get(id: ID): Promise<Result<T, ErrorWithMetadata>> {
    const cache = this.cache;
    const repo = this.repo;
    if (cache) {
      const cached = await cache.get(id, (id) => repo.get(id));
      if (cached.isErr()) {
        this.sharedServiceCtx.logger.error(
          'Failed to get from cache',
          cached.error,
          {
            id,
            service: this.serviceName,
          },
        );
      } else if (cached.value !== undefined) {
        return ok(cached.value);
      }
    }
    return this.repo.get(id);
  }

  async all(): Promise<Result<T[], ErrorWithMetadata>> {
    return this.repo.all();
  }

  async create(
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Result<T, ErrorWithMetadata>> {
    const id = this.sharedServiceCtx.newId();
    const repo = this.repo;
    const result = await repo.create(id, data);
    if (result.isErr()) {
      return err(result.error);
    }
    const cache = this.cache;
    if (cache) {
      const setResult = await cache.set(id, result.value);
      if (setResult.isErr()) {
        this.sharedServiceCtx.logger.error(
          'Failed to set cache after create',
          setResult.error,
          { id, service: this.serviceName },
        );
      }
    }
    return ok(result.value);
  }

  async update(
    id: ID,
    data: Partial<T>,
  ): Promise<Result<T, ErrorWithMetadata>> {
    const repo = this.repo;
    const result = await repo.update(id, data);
    if (result.isErr()) {
      return err(result.error);
    }
    const cache = this.cache;
    if (cache) {
      const setResult = await cache.set(id, result.value);
      if (setResult.isErr()) {
        this.sharedServiceCtx.logger.error(
          'Failed to set cache after update',
          setResult.error,
          { id, service: this.serviceName },
        );
      }
    }
    return ok(result.value);
  }

  async delete(id: ID): Promise<Result<T, ErrorWithMetadata>> {
    const repo = this.repo;
    const result = await repo.delete(id);
    if (result.isErr()) {
      return err(result.error);
    }
    const cache = this.cache;
    if (cache) {
      const delResult = await cache.del(id);
      if (delResult.isErr()) {
        this.sharedServiceCtx.logger.error(
          'Failed to delete cache after delete',
          delResult.error,
          { id, service: this.serviceName },
        );
      }
    }
    return ok(result.value);
  }

  protected get cache() {
    return this.sharedServiceCtx.cache?.();
  }

  protected get repo() {
    return this.sharedServiceCtx.repo();
  }
}
