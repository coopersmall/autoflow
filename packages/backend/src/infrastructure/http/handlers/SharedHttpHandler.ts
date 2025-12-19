/**
 * Shared HTTP handler base class for global resources.
 *
 * Provides standardized CRUD HTTP endpoints for resources that are NOT user-scoped
 * (global/shared data accessible by all users with proper permissions). This follows
 * the same dual-mode pattern as SharedCache and SharedRepo.
 *
 * Architecture:
 * - Mirrors SharedCache/SharedRepo pattern for consistency
 * - Generates standard CRUD routes (GET, POST, PUT, DELETE)
 * - Works with ISharedService for data operations
 * - Automatic route path generation based on service name
 * - Permission-based access control for all operations
 *
 * Use Cases:
 * - System configuration (available to all users)
 * - Shared lookup data (countries, categories, etc.)
 * - Global resources (users table, permissions, etc.)
 *
 * Route Pattern:
 * - GET    /{type}/{serviceName}/:id  - Retrieve single item
 * - GET    /{type}/{serviceName}      - Retrieve all items
 * - POST   /{type}/{serviceName}      - Create new item
 * - PUT    /{type}/{serviceName}/:id  - Update existing item
 * - DELETE /{type}/{serviceName}/:id  - Delete item
 *
 * Where {type} is 'api' or 'app' (determines middleware/auth)
 *
 * @example
 * ```ts
 * class UsersHandler extends SharedHTTPHandler<UserId, User> {
 *   routes() {
 *     return super.routes({ type: 'api', allowed: ['admin'] });
 *   }
 * }
 * // Generates: GET/POST/PUT/DELETE /api/users and /api/users/:id
 * ```
 */

import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type {
  IHttpRoute,
  RouteType,
} from '@backend/infrastructure/http/domain/HttpRoute';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { ISharedService } from '@backend/infrastructure/services/SharedService';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { Permission } from '@core/domain/permissions/permissions';
import type { ExtractMethods } from '@core/types';
import type { Validator } from '@core/validation/validate';
import {
  handleAll,
  handleCreate,
  handleDelete,
  handleGet,
  handleUpdate,
} from './actions/shared/index.ts';
import type { IHttpRouteFactory } from './domain/HttpRouteFactory.ts';

/**
 * Type alias for SharedHTTPHandler interface extraction.
 * Used for dependency injection and mocking.
 */
export type ISharedHTTPHandler<
  ID extends Id<string>,
  T extends Item<ID>,
> = ExtractMethods<SharedHTTPHandler<ID, T>>;

/**
 * Context required to create a SharedHTTPHandler.
 * Provides validators, logger, configuration, and service access.
 */
interface ISharedHTTPHandlerConfig<ID extends Id<string>, T extends Item<ID>> {
  /**
   * Validators for type-safe data validation.
   * - id: Validates ID strings/numbers
   * - partial: Validates creation payloads (no id, timestamps)
   * - update: Validates update payloads (all fields optional except schemaVersion)
   * - item: Validates complete items
   */
  validators: {
    id: Validator<ID>;
    partial: Validator<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;
    update: Validator<Partial<T>>;
    item: Validator<T>;
  };

  /** Logger for request/error logging */
  logger: ILogger;

  /** Application configuration service */
  appConfig: IAppConfigurationService;

  /**
   * HTTP route factory for creating routes with middleware.
   * Injected from app-level to enable middleware composition.
   */
  routeFactory: IHttpRouteFactory;

  /**
   * Lazy service factory.
   * Returns the shared service for data operations.
   */
  service: () => ISharedService<ID, T>;
}

interface SharedHTTPHandlerActions {
  handleGet: typeof handleGet;
  handleAll: typeof handleAll;
  handleCreate: typeof handleCreate;
  handleUpdate: typeof handleUpdate;
  handleDelete: typeof handleDelete;
}

/**
 * Base class for shared resource HTTP handlers.
 *
 * Automatically generates CRUD routes for global/shared resources.
 * Subclasses call `routes()` to get generated route definitions.
 */
export class SharedHTTPHandler<ID extends Id<string>, T extends Item<ID>> {
  private readonly factory: IHttpRouteFactory;

  /**
   * Creates a new shared HTTP handler.
   * @param sharedHttpHandlerCtx - Context with validators, logger, config, service, routeFactory
   */
  constructor(
    private readonly sharedHttpHandlerCtx: ISharedHTTPHandlerConfig<ID, T>,
    private readonly actions: SharedHTTPHandlerActions = {
      handleGet,
      handleAll,
      handleCreate,
      handleUpdate,
      handleDelete,
    },
  ) {
    this.factory = this.sharedHttpHandlerCtx.routeFactory;
  }

  /**
   * Generates all CRUD routes for this shared resource.
   *
   * Subclasses should call this method to get route definitions,
   * typically exposing them via a public routes() method.
   *
   * @param opts - Route configuration
   * @param opts.type - Route type ('api' or 'app') determines auth middleware
   * @param opts.allowed - Required permissions for accessing these routes
   * @returns Array of HTTP routes (GET, GET all, POST, PUT, DELETE)
   *
   * @example
   * ```ts
   * class UsersHandler extends SharedHTTPHandler<UserId, User> {
   *   routes() {
   *     return super.routes({ type: 'api', allowed: ['admin'] });
   *   }
   * }
   * ```
   */
  protected routes(opts: {
    type: RouteType;
    allowed?: Permission[];
    readPermissions?: Permission[];
    writePermissions?: Permission[];
  }): IHttpRoute[] {
    // Use specific permissions if provided, otherwise fall back to 'allowed'
    const readPerms = opts.readPermissions ?? opts.allowed ?? [];
    const writePerms = opts.writePermissions ?? opts.allowed ?? [];

    return [
      this.get({ type: opts.type, allowed: readPerms }),
      this.all({ type: opts.type, allowed: readPerms }),
      this.create({ type: opts.type, allowed: writePerms }),
      this.update({ type: opts.type, allowed: writePerms }),
      this.delete({ type: opts.type, allowed: writePerms }),
    ];
  }

  /**
   * Constructs route path based on type and service name.
   *
   * @param type - Route type ('api' or 'app')
   * @param subPaths - Optional additional path segments
   * @returns Complete route path
   *
   * @example
   * ```ts
   * // For service name 'users' and type 'api':
   * path('api') // '/api/users'
   * path('api', [':id']) // '/api/users/:id'
   * ```
   */
  protected path(type: RouteType, subPaths: string[] = []): string {
    const basePath = `/${type}/${this.sharedHttpHandlerCtx.service().serviceName}`;
    return [basePath, ...subPaths].join('/');
  }

  protected get({
    type,
    allowed,
  }: {
    type: RouteType;
    allowed: Permission[];
  }): IHttpRoute {
    return this.factory.createRoute({
      path: `${this.path(type)}/:id`,
      method: 'GET',
      routeType: type,
      requiredPermissions: allowed,
      handler: async (requestContext) => {
        return this.actions.handleGet(
          {
            service: this.sharedHttpHandlerCtx.service(),
            validators: { id: this.sharedHttpHandlerCtx.validators.id },
          },
          {},
          requestContext,
        );
      },
    });
  }

  private all({
    type,
    allowed,
  }: {
    type: RouteType;
    allowed: Permission[];
  }): IHttpRoute {
    return this.factory.createRoute({
      path: this.path(type),
      method: 'GET',
      routeType: type,
      requiredPermissions: allowed,
      handler: async (requestContext) => {
        return this.actions.handleAll(
          {
            service: this.sharedHttpHandlerCtx.service(),
          },
          {},
          requestContext,
        );
      },
    });
  }

  private create({
    type,
    allowed,
  }: {
    type: RouteType;
    allowed: Permission[];
  }): IHttpRoute {
    return this.factory.createRoute({
      path: this.path(type),
      method: 'POST',
      routeType: type,
      requiredPermissions: allowed,
      handler: async (requestContext) => {
        return this.actions.handleCreate(
          {
            service: this.sharedHttpHandlerCtx.service(),
            validators: {
              partial: this.sharedHttpHandlerCtx.validators.partial,
            },
          },
          {},
          requestContext,
        );
      },
    });
  }

  private update({
    type,
    allowed,
  }: {
    type: RouteType;
    allowed: Permission[];
  }): IHttpRoute {
    return this.factory.createRoute({
      path: `${this.path(type)}/:id`,
      method: 'PUT',
      routeType: type,
      requiredPermissions: allowed,
      handler: async (requestContext) => {
        return this.actions.handleUpdate(
          {
            service: this.sharedHttpHandlerCtx.service(),
            validators: {
              id: this.sharedHttpHandlerCtx.validators.id,
              update: this.sharedHttpHandlerCtx.validators.update,
            },
          },
          {},
          requestContext,
        );
      },
    });
  }

  private delete({
    type,
    allowed,
  }: {
    type: RouteType;
    allowed: Permission[];
  }): IHttpRoute {
    return this.factory.createRoute({
      path: `${this.path(type)}/:id`,
      method: 'DELETE',
      routeType: type,
      requiredPermissions: allowed,
      handler: async (requestContext) => {
        return this.actions.handleDelete(
          {
            service: this.sharedHttpHandlerCtx.service(),
            validators: { id: this.sharedHttpHandlerCtx.validators.id },
          },
          {},
          requestContext,
        );
      },
    });
  }
}
