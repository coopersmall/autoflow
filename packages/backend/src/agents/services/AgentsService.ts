import {
  type AgentRequest,
  type AgentRunId,
  type AgentRunResult,
  type AppError,
  badRequest,
} from '@autoflow/core';
import type { AgentManifest, AgentRunConfig } from '@backend/agents/domain';
import type { IAgentService } from '@backend/agents/domain/AgentService';
import { createMCPService, type IMCPService } from '@backend/ai';
import {
  createCompletionsService,
  type ICompletionsGateway,
} from '@backend/ai/completions';
import type {
  IAppConfigurationService,
  ILogger,
} from '@backend/infrastructure';
import type { Context } from '@backend/infrastructure/context';
import type { StorageProviderConfig } from '@backend/storage/adapters/createStorageProvider';
import type { IStorageService } from '@backend/storage/domain/StorageService';
import { createStorageService } from '@backend/storage/services/StorageService';
import { err, ok, type Result } from 'neverthrow';
import {
  buildManifestMap,
  type CancelResult,
  cancelAgentState,
  runAgent,
  type StreamAgentItem,
  streamAgent,
} from '../actions';
import { validateAgentRunConfig } from '../actions/validation/validateAgentRunConfig';
import {
  createAgentCancellationCache,
  createAgentRunLock,
  createAgentStateCache,
  type IAgentCancellationCache,
  type IAgentRunLock,
  type IAgentStateCache,
} from '../infrastructure';

/**
 * Creates an AgentsService instance for running AI agents.
 *
 * @param config - Configuration including app config, logger, and storage settings
 * @returns A frozen IAgentService instance
 */
export function createAgentsService(
  config: AgentsServiceConfig,
): IAgentService {
  return Object.freeze(new AgentsService(config));
}

/**
 * Configuration for creating an AgentsService instance.
 */
type AgentsServiceConfig = {
  appConfig: IAppConfigurationService;
  logger: ILogger;
  storageProviderConfig: StorageProviderConfig;
};

interface AgentsServiceDependencies {
  readonly createAgentCancellationCache: typeof createAgentCancellationCache;
  readonly createAgentRunLock: typeof createAgentRunLock;
  readonly createAgentStateCache: typeof createAgentStateCache;
  readonly createCompletionsService: typeof createCompletionsService;
  readonly createMCPService: typeof createMCPService;
  readonly createStorageService: typeof createStorageService;
}

const defaultDeps: AgentsServiceDependencies = {
  createAgentCancellationCache,
  createAgentRunLock,
  createAgentStateCache,
  createCompletionsService,
  createMCPService,
  createStorageService,
};

type AgentsServiceActions = Readonly<{
  runAgent: typeof runAgent;
  streamAgent: typeof streamAgent;
}>;

const defaultActions: AgentsServiceActions = {
  runAgent,
  streamAgent,
};

class AgentsService implements IAgentService {
  private readonly cancellationCache: IAgentCancellationCache;
  private readonly agentRunLock: IAgentRunLock;
  private readonly completionsService: ICompletionsGateway;
  private readonly mcpService: IMCPService;
  private readonly storageService: IStorageService;
  private readonly stateCache: IAgentStateCache;

  constructor(
    private readonly config: AgentsServiceConfig,
    private readonly deps: AgentsServiceDependencies = defaultDeps,
    private readonly actions: AgentsServiceActions = defaultActions,
  ) {
    this.cancellationCache = deps.createAgentCancellationCache(config);
    this.agentRunLock = deps.createAgentRunLock(config);
    this.completionsService = deps.createCompletionsService();
    this.mcpService = deps.createMCPService();
    this.storageService = deps.createStorageService(config);
    this.stateCache = deps.createAgentStateCache(config);
  }

  /**
   * Runs an agent to completion without streaming.
   *
   * @param ctx - Request context with correlationId and abort signal
   * @param config - Agent run configuration with manifests and root manifest ID
   * @param request - Agent request with prompt and optional state ID for continuation
   * @returns Result containing the agent run result or an error
   */
  async run(
    ctx: Context,
    config: AgentRunConfig,
    request: AgentRequest,
  ): Promise<Result<AgentRunResult, AppError>> {
    const validateResult = validateAgentRunConfig(config);
    if (validateResult.isErr()) {
      return err(validateResult.error);
    }

    const rootManifestResult = this.getRootManifest(config);
    if (rootManifestResult.isErr()) {
      return err(rootManifestResult.error);
    }

    const rootManifest = rootManifestResult.value;
    const manifestMap = buildManifestMap(config.manifests);

    return this.actions.runAgent(
      ctx,
      rootManifest,
      { ...request, manifestMap },
      this.buildDeps(),
    );
  }

  /**
   * Runs an agent with streaming, yielding events as they occur.
   *
   * @param ctx - Request context with correlationId and abort signal
   * @param config - Agent run configuration with manifests and root manifest ID
   * @param request - Agent request with prompt and optional state ID for continuation
   * @yields StreamAgentItem - Events during execution and final result
   */
  async *stream(
    ctx: Context,
    config: AgentRunConfig,
    request: AgentRequest,
  ): AsyncGenerator<StreamAgentItem> {
    const validateResult = validateAgentRunConfig(config);
    if (validateResult.isErr()) {
      yield { type: 'final', result: err(validateResult.error) };
      return;
    }

    const rootManifestResult = this.getRootManifest(config);
    if (rootManifestResult.isErr()) {
      yield { type: 'final', result: err(rootManifestResult.error) };
      return;
    }

    const rootManifest = rootManifestResult.value;
    const manifestMap = buildManifestMap(config.manifests);

    for await (const item of this.actions.streamAgent(
      ctx,
      rootManifest,
      { ...request, manifestMap },
      this.buildDeps(),
    )) {
      yield item;
    }
  }

  /**
   * Cancels a running or suspended agent.
   *
   * @param ctx - Request context with correlationId and abort signal
   * @param stateId - The agent run ID to cancel
   * @returns Result containing the cancellation outcome or an error
   */
  async cancel(
    ctx: Context,
    stateId: AgentRunId,
  ): Promise<Result<CancelResult, AppError>> {
    return cancelAgentState(
      ctx,
      stateId,
      {
        stateCache: this.stateCache,
        cancellationCache: this.cancellationCache,
        agentRunLock: this.agentRunLock,
      },
      { recursive: true },
    );
  }

  private getRootManifest(
    config: AgentRunConfig,
  ): Result<AgentManifest, AppError> {
    const manifest = config.manifests.find(
      (m) => m.config.id === config.rootManifestId,
    );
    if (!manifest) {
      return err(
        badRequest('Root manifest ID not found in manifests array', {
          metadata: { manifestId: config.rootManifestId },
        }),
      );
    }
    return ok(manifest);
  }

  private buildDeps() {
    return {
      completionsGateway: this.completionsService,
      mcpService: this.mcpService,
      stateCache: this.stateCache,
      storageService: this.storageService,
      logger: this.config.logger,
      agentRunLock: this.agentRunLock,
      cancellationCache: this.cancellationCache,
    };
  }
}
