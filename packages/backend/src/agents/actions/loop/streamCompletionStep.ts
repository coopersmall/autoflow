import type { AgentManifest, AgentRunState } from '@backend/agents/domain';
import type { OnStepStartResult } from '@backend/agents/hooks';
import type { ICompletionsGateway } from '@backend/ai/completions/domain/CompletionsGateway';
import type { Context } from '@backend/infrastructure/context/Context';
import type {
  AgentEvent,
  AgentId,
  StreamableEventType,
  ToolApprovalSuspension,
} from '@core/domain/agents';
import type {
  FinishReason,
  StreamPart,
  ToolCallPart,
  Usage,
} from '@core/domain/ai';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import {
  type TransformContext,
  transformStreamPart,
} from '../streaming/transformStreamPart';

export interface StreamCompletionStepDeps {
  readonly completionsGateway: ICompletionsGateway;
}

export interface StreamCompletionStepParams {
  readonly ctx: Context;
  readonly manifest: AgentManifest;
  readonly manifestId: AgentId;
  readonly parentManifestId: AgentId | undefined;
  readonly stepNumber: number;
  readonly messages: AgentRunState['messages'];
  readonly tools: AgentRunState['tools'];
  readonly stepStartResult: OnStepStartResult | undefined;
  readonly allowedEventTypes: Set<StreamableEventType>;
  readonly deps: StreamCompletionStepDeps;
}

export interface StreamCompletionStepResult {
  readonly toolCalls: ToolCallPart[];
  readonly finishReason: FinishReason;
  readonly approvalRequests: ToolApprovalSuspension[];
  readonly text: string;
  readonly usage: Usage;
}

/**
 * Streams a single LLM completion step, yielding events as they arrive.
 * Returns the accumulated state after the step completes.
 */
export async function* streamCompletionStep(
  params: StreamCompletionStepParams,
): AsyncGenerator<
  Result<AgentEvent, AppError>,
  Result<StreamCompletionStepResult, AppError>
> {
  const {
    ctx,
    manifest,
    manifestId,
    parentManifestId,
    stepNumber,
    messages,
    tools,
    stepStartResult,
    allowedEventTypes,
    deps,
  } = params;

  const transformContext: TransformContext = {
    manifestId,
    parentManifestId,
    stepNumber,
    allowedEventTypes,
  };

  // Accumulated state during streaming
  const toolCalls: ToolCallPart[] = [];
  const approvalRequests: ToolApprovalSuspension[] = [];
  let finishReason: FinishReason = 'unknown';
  let text = '';
  let usage: Usage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };

  // Stream the completion
  const stream = deps.completionsGateway.streamCompletion(
    ctx,
    manifest.config.provider,
    {
      messages,
      tools,
      stopWhen: [{ type: 'stepCount', stepCount: 1 }],
      toolChoice: stepStartResult?.toolChoice,
      activeTools: stepStartResult?.activeTools
        ? [...stepStartResult.activeTools]
        : undefined,
      mcpServers: manifest.config.mcpServers,
    },
  );

  for await (const partResult of stream) {
    if (partResult.isErr()) {
      return err(partResult.error);
    }

    const part = partResult.value;

    // Transform and yield as AgentEvent if applicable
    const event = transformStreamPart(part, transformContext);
    if (event) {
      yield ok(event);
    }

    // Accumulate state based on part type
    accumulateStreamPart(part, {
      toolCalls,
      approvalRequests,
      onFinishReason: (reason) => {
        finishReason = reason;
      },
      onText: (delta) => {
        text += delta;
      },
      onUsage: (u) => {
        usage = u;
      },
    });
  }

  return ok({
    toolCalls,
    finishReason,
    approvalRequests,
    text,
    usage,
  });
}

// =============================================================================
// Helper: accumulateStreamPart
// =============================================================================

interface AccumulateCallbacks {
  readonly toolCalls: ToolCallPart[];
  readonly approvalRequests: ToolApprovalSuspension[];
  readonly onFinishReason: (reason: FinishReason) => void;
  readonly onText: (delta: string) => void;
  readonly onUsage: (usage: Usage) => void;
}

/**
 * Accumulates stream part data into the provided collections and callbacks.
 */
function accumulateStreamPart(
  part: StreamPart,
  callbacks: AccumulateCallbacks,
): void {
  switch (part.type) {
    case 'tool-call':
      callbacks.toolCalls.push(part);
      break;

    case 'tool-approval-request':
      callbacks.approvalRequests.push({
        type: 'tool-approval',
        approvalId: part.approvalId,
        toolName: part.toolCall.toolName,
        toolArgs: part.toolCall.input,
        description: `Tool ${part.toolCall.toolName} requires approval`,
      });
      break;

    case 'text-delta':
      callbacks.onText(part.text);
      break;

    case 'finish-step':
      callbacks.onFinishReason(part.finishReason);
      callbacks.onUsage(part.usage);
      break;

    // Other parts don't affect accumulated state
    default:
      break;
  }
}
