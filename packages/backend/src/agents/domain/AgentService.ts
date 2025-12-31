import type { Context } from '@backend/infrastructure/context';
import type {
  AgentRequest,
  AgentRunId,
  AgentRunResult,
} from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';
import type { CancelResult } from '../actions/state/cancelAgentState';
import type { StreamAgentItem } from '../actions/streamAgent';
import type { AgentRunConfig } from './AgentRunConfig';

/**
 * Agent service interface for running composable AI agents.
 *
 * Provides methods for:
 * - Running agents to completion or suspension
 * - Streaming agent execution with real-time events
 * - Cancelling running or suspended agents
 */
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
  ): AsyncGenerator<StreamAgentItem>;

  /**
   * Cancel an agent run.
   *
   * For suspended agents: Marks the state as cancelled directly.
   * For running agents: Signals cancellation via cache for the polling wrapper to detect.
   * Uses lock-based verification to determine if an agent is truly running or has crashed.
   */
  cancel(
    ctx: Context,
    stateId: AgentRunId,
  ): Promise<Result<CancelResult, AppError>>;
}>;
