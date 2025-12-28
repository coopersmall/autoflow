import {
  createSharedCache,
  type ISharedCache,
} from '@backend/infrastructure/cache/SharedCache';
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { AgentRunId } from '@core/domain/agents';
import { validate } from '@core/validation/validate';
import {
  type CancellationSignal,
  cancellationSignalSchema,
  DEFAULT_CANCELLATION_SIGNAL_TTL,
} from '../../domain';

export type IAgentCancellationCache = ISharedCache<
  AgentRunId,
  CancellationSignal
>;

/**
 * Cache for agent cancellation signals.
 * When a cancellation request is made, a signal is stored here.
 * Running agents poll this cache to detect cancellation requests.
 */
export function createAgentCancellationCache(ctx: {
  logger: ILogger;
  appConfig: IAppConfigurationService;
  ttl?: number;
}): IAgentCancellationCache {
  return createSharedCache<AgentRunId, CancellationSignal>(
    'agent-cancellation',
    {
      logger: ctx.logger,
      appConfig: ctx.appConfig,
      validator: (input) => validate(cancellationSignalSchema, input),
      defaultTtl: ctx.ttl ?? DEFAULT_CANCELLATION_SIGNAL_TTL,
    },
  );
}
