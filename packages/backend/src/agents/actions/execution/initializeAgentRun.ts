import { DEFAULT_AGENT_TIMEOUT } from '@backend/agents/constants';
import type { IMCPService } from '@backend/ai/mcp/domain/MCPService';
import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentManifest, AgentRequest } from '@core/domain/agents';
import type { Message, StepResult, ToolWithExecution } from '@core/domain/ai';
import type { AppError } from '@core/errors/AppError';
import { internalError } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';
import { buildToolExecutionHarness } from '../../tools/harness/buildToolExecutionHarness';
import type { ToolExecutionHarness } from '../../tools/harness/createToolExecutionHarness';
import { buildAgentTools } from '../tools/buildAgentTools';
import { buildInitialMessages } from './buildInitialMessages';

export interface InitializeAgentRunDeps {
  readonly mcpService: IMCPService;
}

/**
 * Mutable state object for agent execution.
 * The agent loop modifies messages, steps, stepNumber, and outputValidationRetries.
 */
export interface AgentRunState {
  readonly startTime: number;
  readonly timeoutMs: number;
  readonly tools: ToolWithExecution[];
  readonly toolsMap: Map<string, ToolWithExecution>;
  readonly harness: ToolExecutionHarness;
  messages: Message[];
  steps: StepResult[];
  stepNumber: number;
  outputValidationRetries: number;
}

/**
 * Initializes a fresh agent run state.
 *
 * Builds:
 * - Initial messages from manifest and request
 * - Tools array and map (including MCP tools)
 * - Tool execution harness
 * - Empty steps array and counters
 */
export async function initializeAgentRun(
  ctx: Context,
  manifest: AgentManifest,
  request: AgentRequest,
  deps: InitializeAgentRunDeps,
): Promise<Result<AgentRunState, AppError>> {
  const startTime = Date.now();
  const timeoutMs = manifest.config.timeout ?? DEFAULT_AGENT_TIMEOUT;

  // Initialize messages
  const messages = buildInitialMessages(manifest, request);

  // Build tools
  const toolsResult = await buildAgentTools(ctx, manifest, {
    mcpService: deps.mcpService,
  });

  if (toolsResult.isErr()) {
    return err(toolsResult.error);
  }

  const { tools, toolsMap } = toolsResult.value;

  // Build tool execution harness
  const harness = buildToolExecutionHarness(manifest.config);

  return ok({
    startTime,
    timeoutMs,
    tools,
    toolsMap,
    harness,
    messages,
    steps: [],
    stepNumber: 0,
    outputValidationRetries: 0,
  });
}

/**
 * Restores agent run state from saved state (for continueAgent).
 *
 * Re-builds tools and harness (they're not persisted), but uses saved:
 * - Messages (after deserializing binary content URLs)
 * - Steps history
 * - Current step number
 * - Adjusts timeout for already-elapsed time
 *
 * TODO: Implement in Phase 4 (HITL)
 * - Add AgentState type to @core/domain/agents
 * - Deserialize messages (refresh signed URLs for binary content)
 * - Restore pending suspension if exists
 * - Handle approval responses
 *
 * @param savedState - Type will be `AgentState` from @core/domain/agents (Phase 4)
 */
export async function restoreAgentRun(
  ctx: Context,
  manifest: AgentManifest,
  savedState: unknown, // Will be AgentState in Phase 4
  deps: InitializeAgentRunDeps,
): Promise<Result<AgentRunState, AppError>> {
  // TODO: Phase 4 implementation
  // const messagesResult = await deserializeMessages(ctx, savedState.messages, deps);
  // if (messagesResult.isErr()) return err(messagesResult.error);

  // For now, return not implemented error
  return err(
    internalError('restoreAgentRun not yet implemented (Phase 4)', {
      metadata: {
        manifestId: manifest.config.id,
      },
    }),
  );
}
