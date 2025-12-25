import type { AgentRunState } from '@backend/agents/domain';
import type { IAgentStateCache } from '@backend/agents/infrastructure/cache';
import type { IMCPService } from '@backend/ai/mcp/domain/MCPService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IStorageService } from '@backend/storage/domain/StorageService';

/**
 * Dependencies for prepare functions.
 */
export interface PrepareAgentRunDeps {
  readonly mcpService: IMCPService;
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
