import type { ILogger } from '@backend/infrastructure/logger/Logger';

/**
 * Dependencies available to middleware factories.
 */
export interface MiddlewareFactoryDeps {
  readonly logger: ILogger;
}
