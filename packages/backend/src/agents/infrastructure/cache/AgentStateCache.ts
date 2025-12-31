import {
  createSharedCache,
  type ISharedCache,
} from '@backend/infrastructure/cache/SharedCache';
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { AgentRunId } from '@core/domain/agents';
import { validate } from '@core/validation/validate';
import {
  type AgentState,
  agentStateSchema,
  DEFAULT_AGENT_STATE_TTL,
} from '../../domain';

export type IAgentStateCache = ISharedCache<AgentRunId, AgentState>;

/**
 * Cache for agent execution state.
 * Uses SharedCache since agent state is not user-scoped (may be system-initiated).
 */
export function createAgentStateCache(ctx: {
  logger: ILogger;
  appConfig: IAppConfigurationService;
  ttl?: number;
}): IAgentStateCache {
  return Object.freeze(
    createSharedCache<AgentRunId, AgentState>('agent-states', {
      logger: ctx.logger,
      appConfig: ctx.appConfig,
      validator: (input) => validate(agentStateSchema, input),
      defaultTtl: ctx.ttl ?? DEFAULT_AGENT_STATE_TTL,
    }),
  );
}
