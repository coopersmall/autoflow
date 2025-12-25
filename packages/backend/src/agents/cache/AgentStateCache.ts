import {
  createSharedCache,
  type ISharedCache,
} from '@backend/infrastructure/cache/SharedCache';
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { AgentStateId } from '@core/domain/agents';
import { validate } from '@core/validation/validate';
import { DEFAULT_AGENT_STATE_TTL } from '../constants';
import { type AgentState, agentStateSchema } from '../domain/AgentState';

export type IAgentStateCache = ISharedCache<AgentStateId, AgentState>;

/**
 * Cache for agent execution state.
 * Uses SharedCache since agent state is not user-scoped (may be system-initiated).
 */
export function createAgentStateCache(ctx: {
  logger: ILogger;
  appConfig: IAppConfigurationService;
  ttl?: number;
}): IAgentStateCache {
  return createSharedCache<AgentStateId, AgentState>('agent-states', {
    logger: ctx.logger,
    appConfig: ctx.appConfig,
    validator: (input) => validate(agentStateSchema, input),
    defaultTtl: ctx.ttl ?? DEFAULT_AGENT_STATE_TTL,
  });
}
