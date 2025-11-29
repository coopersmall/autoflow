import type { IStandardCache } from '@backend/cache/StandardCache';
import type { ILogger } from '@backend/logger/Logger';
import type { IStandardRepo } from '@backend/repos/StandardRepo';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { UserId } from '@core/domain/user/user';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { ExtractMethods } from '@core/types';
import { err, ok, type Result } from 'neverthrow';

export type IStandardService<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> = ExtractMethods<StandardService<ID, T>>;

interface StandardServiceContext<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  logger: ILogger;
  newId: () => ID;
  cache?: () => IStandardCache<ID, T>;
  repo: () => IStandardRepo<ID, T>;
}

export class StandardService<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  constructor(
    readonly serviceName: string,
    private readonly standardServiceCtx: StandardServiceContext<ID, T>,
  ) {}

  async get(id: ID, userId: UserId): Promise<Result<T, ErrorWithMetadata>> {
    const cache = this.cache;
    const repo = this.repo;
    if (cache) {
      const cached = await cache.get(id, userId, (id, userId) =>
        repo.get(id, userId),
      );
      if (cached.isErr()) {
        this.standardServiceCtx.logger.error(
          'Failed to get from cache',
          cached.error,
          {
            id,
            userId,
            service: this.serviceName,
          },
        );
      } else {
        return ok(cached.value);
      }
    }
    return this.repo.get(id, userId);
  }

  async all(userId: UserId): Promise<Result<T[], ErrorWithMetadata>> {
    return this.repo.all(userId);
  }

  async create(
    userId: UserId,
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Result<T, ErrorWithMetadata>> {
    const id = this.standardServiceCtx.newId();
    const repo = this.repo;
    const result = await repo.create(id, userId, data);
    if (result.isErr()) {
      return err(result.error);
    }
    const cache = this.cache;
    if (cache) {
      const setResult = await cache.set(result.value, userId);
      if (setResult.isErr()) {
        this.standardServiceCtx.logger.error(
          'Failed to set cache after create',
          setResult.error,
          { id, userId, service: this.serviceName },
        );
      }
    }
    return ok(result.value);
  }

  async update(
    id: ID,
    userId: UserId,
    data: Partial<T>,
  ): Promise<Result<T, ErrorWithMetadata>> {
    const repo = this.repo;
    const currentResult = await repo.get(id, userId);
    if (currentResult.isErr()) {
      return err(currentResult.error);
    }
    const current = currentResult.value;
    const merged = {
      ...current,
      ...data,
      // createdAt:
      //   current.createdAt instanceof Date
      //     ? current.createdAt
      //     : new Date(current.createdAt as string),
      // updatedAt:
      //   current.updatedAt instanceof Date
      //     ? current.updatedAt
      //     : new Date(current.updatedAt as string),
    };
    const result = await repo.update(id, userId, merged);
    if (result.isErr()) {
      return err(result.error);
    }
    const cache = this.cache;
    if (cache) {
      const setResult = await cache.set(result.value, userId);
      if (setResult.isErr()) {
        this.standardServiceCtx.logger.error(
          'Failed to set cache after update',
          setResult.error,
          { id, userId, service: this.serviceName },
        );
      }
    }
    return ok(result.value);
  }

  async delete(id: ID, userId: UserId): Promise<Result<T, ErrorWithMetadata>> {
    const repo = this.repo;
    const result = await repo.delete(id, userId);
    if (result.isErr()) {
      return err(result.error);
    }
    const cache = this.cache;
    if (cache) {
      const delResult = await cache.del(id, userId);
      if (delResult.isErr()) {
        this.standardServiceCtx.logger.error(
          'Failed to delete cache after delete',
          delResult.error,
          { id, userId, service: this.serviceName },
        );
      }
    }
    return ok(result.value);
  }

  protected get cache() {
    return this.standardServiceCtx.cache?.();
  }

  protected get repo() {
    return this.standardServiceCtx.repo();
  }
}
