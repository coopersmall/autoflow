import type { AgentStateId } from '@autoflow/core';
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import {
  createDistributedLock,
  type IDistributedLock,
} from '@backend/infrastructure/lock/DistributedLock';
import type { ILogger } from '@backend/infrastructure/logger/Logger';

export type IAgentLock = IDistributedLock<AgentStateId>;

/**
 * Creates a distributed lock for agent continuation operations.
 *
 * This lock prevents concurrent continuation of the same suspended agent state.
 * Used by the continueAgent action to ensure only one request can continue
 * a suspended agent at a time.
 *
 * Lock namespace: 'agent-continuation'
 * Lock key format: 'lock:agent-continuation:{stateId}'
 * Default TTL: 300 seconds (5 minutes)
 */
export function createAgentLock(ctx: {
  logger: ILogger;
  appConfig: IAppConfigurationService;
}): IAgentLock {
  return createDistributedLock<AgentStateId>('agent-continuation', {
    logger: ctx.logger,
    appConfig: ctx.appConfig,
    provider: 'redis',
    defaultTtl: 300, // 5 minutes - long enough for most agent continuations
  });
}
