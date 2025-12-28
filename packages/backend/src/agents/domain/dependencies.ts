import type { ICompletionsGateway } from '@backend/ai/completions/domain/CompletionsGateway';
import type { IMCPService } from '@backend/ai/mcp/domain/MCPService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IStorageService } from '@backend/storage/domain/StorageService';
import type {
  IAgentCancellationCache,
  IAgentStateCache,
} from '../infrastructure/cache';
import type { IAgentRunLock } from '../infrastructure/lock';

/**
 * Composable dependency interfaces for agent execution.
 *
 * Use these to build function signatures instead of defining
 * custom *Deps interfaces in every file.
 *
 * This promotes consistency and makes it easier to understand
 * what dependencies each part of the system requires.
 */

/** Core AI completion dependencies */
export interface CompletionDeps {
  readonly completionsGateway: ICompletionsGateway;
}

/** MCP integration dependencies */
export interface MCPDeps {
  readonly mcpService: IMCPService;
}

/** State persistence dependencies */
export interface StateDeps {
  readonly stateCache: IAgentStateCache;
}

/** Storage dependencies */
export interface StorageDeps {
  readonly storageService: IStorageService;
}

/** Logging dependencies */
export interface LoggingDeps {
  readonly logger: ILogger;
}

/** Cancellation dependencies */
export interface CancellationDeps {
  readonly agentRunLock: IAgentRunLock;
  readonly cancellationCache: IAgentCancellationCache;
}

/** Full agent execution dependencies */
export interface AgentExecutionDeps
  extends CompletionDeps,
    MCPDeps,
    StateDeps,
    StorageDeps,
    LoggingDeps,
    CancellationDeps {}

/** Dependencies for serialization operations */
export interface SerializationDeps extends StorageDeps, LoggingDeps {}

/** Dependencies for state preparation */
export interface PrepareDeps extends StateDeps, StorageDeps, LoggingDeps {}
