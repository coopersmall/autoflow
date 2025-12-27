import type {
  AgentEvent,
  AgentRequest,
  AgentRunConfig,
  AgentRunId,
  AgentRunOptions,
  AgentRunResult,
  AppError,
  ContinueResponse,
} from '@autoflow/core';
import { createMCPService } from '@backend/ai';
import { createCompletionsService } from '@backend/ai/completions';
import type { ILogger } from '@backend/infrastructure';
import type { Context } from '@backend/infrastructure/context';
import { createStorageService } from '@backend/storage/services/StorageService';
import { err, type Result } from 'neverthrow';
import { runAgent, type StreamAgentItem, streamAgent } from '../actions';
import { validateAgentRunConfig } from '../builder/buildAgentRunConfig';
import { createAgentStateCache } from '../infrastructure';

export type IAgentService = Readonly<{
  /**
   * Run an agent to completion or until suspended.
   *
   * The config contains a flat array of all manifests. The framework validates
   * that all sub-agent references can be resolved from this array.
   */
  run(
    ctx: Context,
    config: AgentRunConfig,
    request: AgentRequest,
    options?: AgentRunOptions,
  ): Promise<Result<AgentRunResult, AppError>>;

  /**
   * Continue a suspended agent run.
   *
   * Provide the same config used for run(). The framework validates that
   * manifest IDs and versions match the saved state.
   */
  continue(
    ctx: Context,
    config: AgentRunConfig,
    stateId: AgentRunId,
    options?: AgentRunOptions,
  ): Promise<Result<AgentRunResult, AppError>>;

  /**
   * Stream an agent run.
   *
   * When a suspension event is yielded, the stream ends.
   * Use continueStream() to resume after providing approval.
   */
  stream(
    ctx: Context,
    config: AgentRunConfig,
    request: AgentRequest,
    options?: AgentRunOptions,
  ): AsyncGenerator<Result<AgentEvent, AppError>>;

  /**
   * Continue streaming a suspended agent run.
   */
  continueStream(
    ctx: Context,
    config: AgentRunConfig,
    stateId: AgentRunId,
    response: ContinueResponse,
    options?: AgentRunOptions,
  ): AsyncGenerator<Result<AgentEvent, AppError>>;

  /**
   * Cancel a suspended agent run.
   *
   * Marks the state as 'cancelled' and prevents future continuation.
   * Does not affect already-running continuations.
   */
  cancel(ctx: Context, stateId: AgentRunId): Promise<Result<void, AppError>>;
}>;

export function createAgentsService(
  context: AgentServiceContext,
): IAgentService {
  return new AgentsService(context);
}

type AgentServiceContext = {
  logger: ILogger;
};

type AgentsServiceDeps = {
  createAgentStateCache: typeof createAgentStateCache;
  createCompletionsService: typeof createCompletionsService;
  createMCPService: typeof createMCPService;
  createStorageService: typeof createStorageService;
};

const defaultDeps: AgentsServiceDeps = {
  createAgentStateCache,
  createCompletionsService,
  createMCPService,
  createStorageService,
};

type AgentsServiceActions = {
  runAgent: typeof runAgent;
  streamAgent: typeof streamAgent;
  validateAgentRunConfig: typeof validateAgentRunConfig;
};

const defaultActions: AgentsServiceActions = {
  runAgent,
  streamAgent,
  validateAgentRunConfig,
};

class AgentsService implements IAgentService {
  constructor(
    private readonly context: AgentServiceContext,
    private readonly deps: AgentsServiceDeps = defaultDeps,
    private readonly actions: AgentsServiceActions = defaultActions,
  ) {}

  async run(
    ctx: Context,
    config: AgentRunConfig,
    request: AgentRequest,
    options?: AgentRunOptions,
  ): Promise<Result<AgentRunResult, AppError>> {
    const validateResult = this.actions.validateAgentRunConfig(config);
    if (validateResult.isErr()) {
      return err(validateResult.error);
    }
    const { rootManifest } = validateResult.value;
    return this.actions.runAgent(
      ctx,
      rootManifest,
      {
        type: 'request',
        request,
        options,
      },
      this.deps,
    );
  }

  async continue(
    ctx: Context,
    config: AgentRunConfig,
    runId: AgentRunId,
    options?: AgentRunOptions,
  ): Promise<Result<AgentRunResult, AppError>> {
    const validateResult = this.actions.validateAgentRunConfig(config);
    if (validateResult.isErr()) {
      return err(validateResult.error);
    }
    const { rootManifest } = validateResult.value;
    return this.actions.runAgent(
      ctx,
      rootManifest,
      {
        type: 'continue',
        runId,
        options,
      },
      this.deps,
    );
  }

  async *stream(
    ctx: Context,
    config: AgentRunConfig,
    request: AgentRequest,
    options?: AgentRunOptions,
  ): AsyncGenerator<StreamAgentItem> {
    const validateResult = this.actions.validateAgentRunConfig(config);
    if (validateResult.isErr()) {
      yield err(validateResult.error);
      return;
    }
    const { rootManifest } = validateResult.value;
    for await (const item of this.actions.streamAgent(
      ctx,
      rootManifest,
      {
        type: 'request',
        request,
        options,
      },
      this.deps,
    )) {
      yield item;
    }
  }

  async *continueStream(
    ctx: Context,
    config: AgentRunConfig,
    runId: AgentRunId,
    response: ContinueResponse,
    options?: AgentRunOptions,
  ): AsyncGenerator<StreamAgentItem> {
    const validateResult = this.actions.validateAgentRunConfig(config);
    if (validateResult.isErr()) {
      yield err(validateResult.error);
      return;
    }
    const { rootManifest } = validateResult.value;
    for await (const item of this.actions.streamAgent(
      ctx,
      rootManifest,
      {
        type: 'continue',
        runId,
        response,
        options,
      },
      this.deps,
    )) {
      yield item;
    }
  }
}
