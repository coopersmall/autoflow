import type {
  AgentRunOptions,
  AgentState,
  PrepareDeps,
} from '@backend/agents/domain';
import type { IMCPService } from '@backend/ai';
import type { ICompletionsGateway } from '@backend/ai/completions';
import type { Context } from '@backend/infrastructure/context/Context';
import type {
  AgentManifest,
  AgentRunResult,
  ContinueResponse,
  SuspensionStack,
} from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';
import { consumeGenerator } from '../utils/consumeGenerator';
import type { HandleCompletionDeps } from './handleCompletion';
import {
  type StreamResumeFromStackActions,
  streamResumeFromSuspensionStack,
} from './streamResumeFromSuspensionStack';

export interface ResumeFromStackDeps extends PrepareDeps, HandleCompletionDeps {
  readonly completionsGateway: ICompletionsGateway;
  readonly mcpService: IMCPService;
}

/**
 * Non-streaming resume from suspension stack - consumes the streaming version.
 * All complex logic lives in streamResumeFromSuspensionStack.
 *
 * This is a thin wrapper that:
 * 1. Calls the streaming version
 * 2. Consumes all events (discarding them)
 * 3. Returns the final result
 *
 * The stack structure is: [root, child, grandchild, ..., deepest]
 * where the last entry is the agent that actually triggered the suspension.
 */
export async function resumeFromSuspensionStack(
  ctx: Context,
  manifest: AgentManifest,
  manifestMap: Map<string, AgentManifest>,
  savedState: AgentState,
  matchingStack: SuspensionStack,
  response: ContinueResponse,
  deps: ResumeFromStackDeps,
  options?: AgentRunOptions,
  actions?: StreamResumeFromStackActions,
): Promise<Result<AgentRunResult, AppError>> {
  return consumeGenerator(
    streamResumeFromSuspensionStack(
      ctx,
      manifest,
      manifestMap,
      savedState,
      matchingStack,
      response,
      deps,
      actions,
      options,
    ),
  );
}
