import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import {
  createDistributedLock,
  type IDistributedLock,
} from '@backend/infrastructure/lock/DistributedLock';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { AgentRunId } from '@core/domain/agents';
import { DEFAULT_AGENT_RUN_LOCK_TTL } from '../../domain';

export type IAgentRunLock = IDistributedLock<AgentRunId>;

/**
 * Creates a distributed lock for agent execution operations.
 *
 * This lock prevents concurrent execution of the same agent (both fresh runs
 * and continuations). The lock key is the stateId, so:
 * - Fresh request: New stateId generated -> new lock -> no contention
 * - Continuation (reply/approval/continue): Same stateId -> same lock -> prevents concurrent continuation
 *
 * This replaces the unused AgentLock (agent-continuation namespace) with a unified
 * lock that covers the entire execution lifecycle.
 *
 * Lock namespace: 'agent-run'
 * Lock key format: 'lock:agent-run:{stateId}'
 * Default TTL: DEFAULT_AGENT_RUN_LOCK_TTL (10 minutes)
 *
 * The TTL serves as:
 * 1. Safety net for crashes (lock auto-releases)
 * 2. Implicit "heartbeat" for crash detection (if we can acquire lock but state is 'running',
 *    and execution duration > TTL, the agent crashed)
 */
export function createAgentRunLock(ctx: {
  logger: ILogger;
  appConfig: IAppConfigurationService;
  ttl?: number;
}): IAgentRunLock {
  return createDistributedLock<AgentRunId>('agent-run', {
    logger: ctx.logger,
    appConfig: ctx.appConfig,
    provider: 'redis',
    defaultTtl: ctx.ttl ?? DEFAULT_AGENT_RUN_LOCK_TTL,
  });
}
