import type { AgentRunState } from '@backend/agents/domain';
import type { IAgentStateCache } from '@backend/agents/infrastructure/cache';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IStorageService } from '@backend/storage/domain/StorageService';

/**
 * Dependencies for prepare functions.
 * Tools are now passed separately, so mcpService is not needed here.
 */
export interface PrepareAgentRunDeps {
  readonly stateCache: IAgentStateCache;
  readonly storageService: IStorageService;
  readonly logger: ILogger;
}

/**
 * Result from prepare functions.
 * Contains the agent run state plus metadata needed for saving.
 */
export type PrepareResult = {
  readonly state: AgentRunState;
  readonly context?: Record<string, unknown>;
  readonly previousElapsedMs: number;
};
