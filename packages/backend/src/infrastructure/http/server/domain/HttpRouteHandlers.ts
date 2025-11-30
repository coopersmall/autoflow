import type { Request } from '@backend/infrastructure/http/handlers/domain/Request';

/**
 * HTTP route handlers organized by path and method.
 *
 * Maps URL paths to their HTTP method handlers. Each path can have
 * handlers for GET, POST, PUT, and DELETE methods.
 *
 * @example
 * ```ts
 * const routes: RouteHandlers = {
 *   '/api/users': {
 *     GET: (req) => new Response('List users'),
 *     POST: (req) => new Response('Create user')
 *   },
 *   '/api/users/:id': {
 *     GET: (req) => new Response('Get user'),
 *     PUT: (req) => new Response('Update user'),
 *     DELETE: (req) => new Response('Delete user')
 *   }
 * };
 * ```
 */
export interface RouteHandlers {
  [path: string]: {
    GET?: (req: Request) => Response | Promise<Response>;
    POST?: (req: Request) => Response | Promise<Response>;
    PUT?: (req: Request) => Response | Promise<Response>;
    DELETE?: (req: Request) => Response | Promise<Response>;
  };
}
