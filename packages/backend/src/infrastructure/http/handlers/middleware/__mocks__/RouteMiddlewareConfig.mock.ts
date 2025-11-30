import type { RouteMiddlewareConfig } from '@backend/infrastructure/http/handlers/middleware/domain/MiddlewareConfig';

/**
 * Mock middleware config with no middleware for testing.
 */
export function getMockRouteMiddlewareConfig(): RouteMiddlewareConfig {
  return {
    api: [],
    app: [],
    public: [],
  };
}
