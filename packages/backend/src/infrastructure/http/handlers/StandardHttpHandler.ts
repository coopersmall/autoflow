/**
 * Standard HTTP handler base class for user-scoped resources.
 *
 * Provides standardized CRUD HTTP endpoints for resources that ARE user-scoped
 * (data isolated per user). This follows the same dual-mode pattern as StandardCache
 * and StandardRepo, ensuring data isolation and automatic userId extraction.
 *
 * Architecture:
 * - Mirrors StandardCache/StandardRepo pattern for consistency
 * - Generates standard CRUD routes with userId in path
 * - Works with StandardService for user-scoped data operations
 * - Automatic userId extraction and validation on all operations
 * - Permission-based access control for all operations
 *
 * Use Cases:
 * - User documents (notes, files, etc.)
 * - User preferences and settings
 * - User-specific integrations
 * - Any resource that belongs to a specific user
 *
 * Route Pattern:
 * - GET    /{type}/users/:userId/{serviceName}/:id  - Retrieve user's item
 * - GET    /{type}/users/:userId/{serviceName}      - Retrieve all user's items
 * - POST   /{type}/users/:userId/{serviceName}      - Create item for user
 * - PUT    /{type}/users/:userId/{serviceName}/:id  - Update user's item
 * - DELETE /{type}/users/:userId/{serviceName}/:id  - Delete user's item
 *
 * Where {type} is 'api' or 'app' (determines middleware/auth)
 *
 * Key Difference from SharedHttpHandler:
 * - ALL operations automatically extract and validate userId from path
 * - Service methods receive userId for data isolation
 * - Routes include /users/:userId/ segment
 *
 * @example
 * ```ts
 * class DocumentsHandler extends StandardHTTPHandler<DocumentId, Document> {
 *   handlers() {
 *     return super.handlers({ type: 'api', allowed: ['read:documents'] });
 *   }
 * }
 * // Generates: GET/POST/PUT/DELETE /api/users/:userId/documents/...
 * ```
 */

import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type {
  IHttpRoute,
  RouteType,
} from '@backend/infrastructure/http/domain/HttpRoute';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { StandardService } from '@backend/infrastructure/services/StandardService';
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
} from './actions/standard/index';
import type { IHttpRouteFactory } from './domain/HttpRouteFactory';

/**
 * Type alias for StandardHTTPHandler interface extraction.
 * Used for dependency injection and mocking.
 */
export type IStandardHTTPHandler<
  ID extends Id<string>,
  T extends Item<ID>,
> = ExtractMethods<StandardHTTPHandler<ID, T>>;

/**
 * Context required to create a StandardHTTPHandler.
 * Provides validators, logger, configuration, and service access.
 */
interface IStandardHTTPHandlerConfig<
  ID extends Id<string>,
  T extends Item<ID>,
> {
  /**
   * Validators for type-safe data validation.
   * - id: Validates resource ID strings/numbers
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
   * Returns the standard (user-scoped) service for data operations.
   */
  service: () => StandardService<ID, T>;
}

interface StandardHTTPHandlerActions {
  handleGet: typeof handleGet;
  handleAll: typeof handleAll;
  handleCreate: typeof handleCreate;
  handleUpdate: typeof handleUpdate;
  handleDelete: typeof handleDelete;
}

/**
 * Base class for user-scoped resource HTTP handlers.
 *
 * Automatically generates CRUD routes with userId parameter for user-scoped resources.
 * Subclasses call `handlers()` to get generated route definitions.
 */
export class StandardHTTPHandler<ID extends Id<string>, T extends Item<ID>> {
  private readonly factory: IHttpRouteFactory;

  /**
   * Creates a new standard (user-scoped) HTTP handler.
   * @param ctx - Context with validators, logger, config, service, routeFactory
   */
  constructor(
    private readonly ctx: IStandardHTTPHandlerConfig<ID, T>,
    private readonly actions: StandardHTTPHandlerActions = {
      handleGet,
      handleAll,
      handleCreate,
      handleUpdate,
      handleDelete,
    },
  ) {
    this.factory = this.ctx.routeFactory;
  }

  /**
   * Generates all CRUD routes for this user-scoped resource.
   *
   * Subclasses should call this method to get route definitions,
   * typically exposing them via a public handlers() method.
   *
   * @param opts - Route configuration
   * @param opts.type - Route type ('api' or 'app') determines auth middleware
   * @param opts.allowed - Required permissions for all routes (deprecated, use readPermissions/writePermissions)
   * @param opts.readPermissions - Required permissions for GET operations (user needs at least one)
   * @param opts.writePermissions - Required permissions for POST/PUT/DELETE operations (user needs at least one)
   * @returns Array of HTTP routes (GET, GET all, POST, PUT, DELETE) with userId param
   *
   * @example
   * ```ts
   * class DocumentsHandler extends StandardHTTPHandler<DocumentId, Document> {
   *   handlers() {
   *     return super.handlers({
   *       type: 'api',
   *       readPermissions: ['admin', 'read:documents'],
   *       writePermissions: ['admin']
   *     });
   *   }
   * }
   * ```
   */
  protected handlers(opts: {
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
   * Constructs route path based on type and service name, including userId parameter.
   *
   * @param type - Route type ('api' or 'app')
   * @param subPaths - Optional additional path segments
   * @returns Complete route path with userId parameter
   *
   * @example
   * ```ts
   * // For service name 'documents' and type 'api':
   * path('api') // '/api/users/:userId/documents'
   * path('api', [':id']) // '/api/users/:userId/documents/:id'
   * ```
   */
  protected path(type: RouteType, subPaths: string[] = []): string {
    const baseUrl = `/${type}/users/:userId/${this.ctx.service().serviceName}`;
    return [baseUrl, ...subPaths].join('/');
  }

  private get({
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
            service: this.ctx.service(),
            validators: { id: this.ctx.validators.id },
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
          { service: this.ctx.service() },
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
            service: this.ctx.service(),
            validators: { partial: this.ctx.validators.partial },
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
            service: this.ctx.service(),
            validators: {
              id: this.ctx.validators.id,
              update: this.ctx.validators.update,
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
            service: this.ctx.service(),
            validators: { id: this.ctx.validators.id },
          },
          {},
          requestContext,
        );
      },
    });
  }
}
