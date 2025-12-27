import type { AgentState } from '@backend/agents/domain';
import type { IAgentStateCache } from '@backend/agents/infrastructure/cache';
import type { IMCPService } from '@backend/ai';
import type { ICompletionsGateway } from '@backend/ai/completions';
import type { Context } from '@backend/infrastructure/context/Context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IStorageService } from '@backend/storage/domain/StorageService';
import type {
  AgentManifest,
  AgentRunResult,
  SuspensionStack,
} from '@core/domain/agents';
import type { RequestToolResultPart } from '@core/domain/ai';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';
import { consumeGenerator } from '../utils/consumeGenerator';
import {
  type StreamHandleCompletionActions,
  streamHandleCompletion,
} from './streamHandleCompletion';

export interface HandleCompletionDeps {
  readonly completionsGateway: ICompletionsGateway;
  readonly mcpService: IMCPService;
  readonly stateCache: IAgentStateCache;
  readonly storageService: IStorageService;
  readonly logger: ILogger;
}

/**
 * Non-streaming handle completion - consumes the streaming version.
 * All logic lives in streamHandleCompletion.
 *
 * This is a thin wrapper that:
 * 1. Calls the streaming version
 * 2. Consumes all events (discarding them)
 * 3. Returns the final result
 */
export async function handleCompletion(
  ctx: Context,
  manifest: AgentManifest,
  manifestMap: Map<string, AgentManifest>,
  savedState: AgentState,
  completedStack: SuspensionStack,
  toolResult: RequestToolResultPart,
  deps: HandleCompletionDeps,
  actions?: StreamHandleCompletionActions,
): Promise<Result<AgentRunResult, AppError>> {
  return consumeGenerator(
    streamHandleCompletion(
      ctx,
      manifest,
      manifestMap,
      savedState,
      completedStack,
      toolResult,
      deps,
      actions,
    ),
  );
}
