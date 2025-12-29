import type { AgentInput, AgentManifest } from '@backend/agents/domain';
import type { IAgentCancellationCache } from '@backend/agents/infrastructure/cache';
import type { IAgentRunLock } from '@backend/agents/infrastructure/lock';
import type { ICompletionsGateway } from '@backend/ai/completions/domain/CompletionsGateway';
import type { IMCPService } from '@backend/ai/mcp/domain/MCPService';
import type { Context } from '@backend/infrastructure/context/Context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IStorageService } from '@backend/storage/domain/StorageService';
import type { AgentRunResult } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';
import type { IAgentStateCache } from '../infrastructure/cache';
import { orchestrateAgentRun } from './orchestrateAgentRun';

export interface RunAgentDeps {
  readonly completionsGateway: ICompletionsGateway;
  readonly mcpService: IMCPService;
  readonly stateCache: IAgentStateCache;
  readonly storageService: IStorageService;
  readonly logger: ILogger;
  readonly agentRunLock: IAgentRunLock;
  readonly cancellationCache: IAgentCancellationCache;
}

/**
 * Non-streaming agent execution entry point.
 *
 * Thin wrapper around orchestrateAgentRun that consumes the generator
 * and returns only the final result.
 *
 * Handles three types of execution:
 * 1. Fresh start from AgentRequest
 * 2. Reply to a completed agent with additional user message
 * 3. Resume suspended agent after tool approval
 *
 * NOTE: Callers should validate the agent configuration before calling this function
 * using `validateAgentConfig(manifest, manifests)` to ensure sub-agent references
 * and other config validations pass. This validation will be automatic when using
 * AgentService, but direct callers should validate manually.
 */
export async function runAgent(
  ctx: Context,
  manifest: AgentManifest,
  input: AgentInput,
  deps: RunAgentDeps,
): Promise<Result<AgentRunResult, AppError>> {
  const generator = orchestrateAgentRun(ctx, manifest, input, deps);

  // Consume generator, discard events, return final result
  while (true) {
    const next = await generator.next();
    if (next.done) {
      return next.value;
    }
    // Discard events (non-streaming mode)
  }
}
