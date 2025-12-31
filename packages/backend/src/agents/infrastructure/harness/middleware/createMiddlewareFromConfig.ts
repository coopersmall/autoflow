import type { ToolMiddlewareConfig } from '@core/domain/agents';
import type {
  StreamingToolExecutionMiddleware,
  ToolExecutionMiddleware,
} from '@core/domain/agents/tools';
import { unreachable } from '@core/unreachable';
import {
  createRetryMiddleware,
  createStreamingRetryMiddleware,
} from './createRetryMiddleware';
import {
  createStreamingTimeoutMiddleware,
  createTimeoutMiddleware,
} from './createTimeoutMiddleware';
import type { MiddlewareFactoryDeps } from './types';

/**
 * Creates streaming middleware instances from configuration array.
 */
export function createStreamingMiddlewareFromConfig(
  configs: readonly ToolMiddlewareConfig[],
  deps: MiddlewareFactoryDeps,
): StreamingToolExecutionMiddleware[] {
  return configs.map((config) => {
    switch (config.type) {
      case 'timeout':
        return createStreamingTimeoutMiddleware(config, deps);
      case 'retry':
        return createStreamingRetryMiddleware(config, deps);
      default:
        return unreachable(config);
    }
  });
}

/**
 * Creates non-streaming middleware instances from configuration array.
 */
export function createMiddlewareFromConfig(
  configs: readonly ToolMiddlewareConfig[],
  deps: MiddlewareFactoryDeps,
): ToolExecutionMiddleware[] {
  return configs.map((config) => {
    switch (config.type) {
      case 'timeout':
        return createTimeoutMiddleware(config, deps);
      case 'retry':
        return createRetryMiddleware(config, deps);
      default:
        return unreachable(config);
    }
  });
}
