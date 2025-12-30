import type { AgentInput, AgentManifest } from '@backend/agents/domain';
import {
  type AgentRequest,
  type AgentRunId,
  AgentToolResult,
  type AgentToolWithStreamingContext,
  type ManifestKey,
  type SubAgentConfig,
} from '@core/domain/agents';
import type { JSONSchema7 } from 'ai';
import { ok } from 'neverthrow';
import {
  type StreamAgentDeps,
  type StreamAgentFinalResult,
  type StreamAgentItem,
  streamAgent,
} from '../streamAgent';
import { createSubAgentContext } from './createSubAgentContext';
import { parseSubAgentArgs } from './parseSubAgentArgs';

export interface CreateStreamingSubAgentToolDeps extends StreamAgentDeps {}

const defaultParameters: JSONSchema7 = {
  type: 'object',
  properties: {
    prompt: { type: 'string', description: 'Task for the sub-agent' },
    context: { type: 'object', description: 'Additional context' },
  },
  required: ['prompt'],
} as const;

/**
 * Type guard to check if a StreamAgentItem is the final result.
 * StreamAgentFinalResult has { type: 'final', result: Result<...> }
 * while Result<AgentEvent> has { isOk(), isErr(), ... }
 */
function isFinalResult(item: StreamAgentItem): item is StreamAgentFinalResult {
  // Check if it's a StreamAgentFinalResult by looking for the 'result' property
  // Result<AgentEvent> doesn't have a 'result' property, but StreamAgentFinalResult does
  return (
    typeof item === 'object' &&
    item !== null &&
    'type' in item &&
    'result' in item &&
    item.type === 'final'
  );
}

/**
 * Creates a streaming tool that executes a sub-agent.
 *
 * Unlike the non-streaming createSubAgentTool, this version yields events
 * during sub-agent execution, enabling real-time streaming of nested agent
 * activity to the parent.
 *
 * This is framework-internal code. Users declare sub-agents via SubAgentConfig.
 * The framework creates the actual tool and handles:
 * - Looking up the sub-agent manifest from the flat registry
 * - Streaming the sub-agent execution via streamAgent
 * - Yielding events with proper parentManifestId attribution
 * - Calling parent's sub-agent lifecycle hooks (onSubAgentComplete, etc.)
 * - Returning AgentToolResult (success, error, or suspended)
 */
export function createStreamingSubAgentTool(
  config: SubAgentConfig,
  parentManifest: AgentManifest,
  subAgentManifest: AgentManifest,
  mapper: ((args: unknown) => AgentRequest) | undefined,
  manifestMap: Map<ManifestKey, AgentManifest>,
  deps: CreateStreamingSubAgentToolDeps,
): AgentToolWithStreamingContext {
  return Object.freeze({
    type: 'function',
    function: {
      name: config.name,
      description: config.description,
      parameters: config.parameters ?? defaultParameters,
    },
    executeStreamingWithContext: async function* (tool, toolCall, execCtx) {
      // 1. Parse and validate args
      const argsResult = parseSubAgentArgs(toolCall.input, mapper);
      if (argsResult.isErr()) {
        return argsResult.error;
      }
      const agentRequest: AgentRequest = argsResult.value;

      // 2. Create sub-agent context with independent timeout
      const subCtx = createSubAgentContext(execCtx.ctx, config.timeout);

      // 3. Yield sub-agent-start event
      yield ok({
        type: 'sub-agent-start',
        manifestId: execCtx.manifestId,
        parentManifestId: execCtx.parentManifestId,
        timestamp: Date.now(),
        subAgentManifestId: subAgentManifest.config.id,
        subAgentToolName: config.name,
      });

      // 4. Stream sub-agent execution, yielding events as they arrive
      let finalResult: ReturnType<typeof AgentToolResult.success> | undefined;
      let childStateId: AgentRunId | undefined;

      const input: AgentInput = {
        ...agentRequest,
        manifestMap,
        parentContext: {
          parentManifestId: execCtx.manifestId,
          parentManifestVersion: execCtx.manifestVersion,
          toolCallId: toolCall.toolCallId,
        },
      };

      for await (const item of streamAgent(
        subCtx,
        subAgentManifest,
        input,
        deps,
      )) {
        // Capture child's stateId from agent-started event and call onSubAgentStart
        if (
          !isFinalResult(item) &&
          item.isOk() &&
          item.value.type === 'agent-started' &&
          item.value.manifestId === subAgentManifest.config.id
        ) {
          childStateId = item.value.stateId;

          // Call onSubAgentStart hook - child state now exists
          if (parentManifest.hooks?.onSubAgentStart) {
            const hookResult = await parentManifest.hooks.onSubAgentStart(
              subCtx,
              {
                parentManifestId: execCtx.manifestId,
                parentManifestVersion: execCtx.manifestVersion,
                parentStateId: execCtx.stateId,
                childManifestId: subAgentManifest.config.id,
                childManifestVersion: subAgentManifest.config.version,
                childStateId,
                toolCallId: toolCall.toolCallId,
              },
            );
            if (hookResult.isErr()) {
              // Cancel the child agent to prevent orphaned execution
              subCtx.cancel();
              return AgentToolResult.error(
                hookResult.error.message,
                hookResult.error.code,
              );
            }
          }
        }

        // Check for final result (StreamAgentFinalResult)
        if (isFinalResult(item)) {
          if (item.result.isErr()) {
            // Sub-agent had an error - call onSubAgentError hook
            if (parentManifest.hooks?.onSubAgentError && childStateId) {
              await parentManifest.hooks.onSubAgentError(subCtx, {
                parentManifestId: execCtx.manifestId,
                parentManifestVersion: execCtx.manifestVersion,
                parentStateId: execCtx.stateId,
                childManifestId: subAgentManifest.config.id,
                childManifestVersion: subAgentManifest.config.version,
                childStateId,
                toolCallId: toolCall.toolCallId,
                error: {
                  code: item.result.error.code,
                  message: item.result.error.message,
                },
              });
            }

            // Yield sub-agent-end event and return error
            yield ok({
              type: 'sub-agent-end',
              manifestId: execCtx.manifestId,
              parentManifestId: execCtx.parentManifestId,
              timestamp: Date.now(),
              subAgentManifestId: subAgentManifest.config.id,
              subAgentToolName: config.name,
              status: 'error',
            });

            return AgentToolResult.error(
              item.result.error.message,
              item.result.error.code,
            );
          }

          const agentRunResult = item.result.value;

          // Sub-agent suspended
          if (agentRunResult.status === 'suspended') {
            // Call onSubAgentSuspend hook
            if (parentManifest.hooks?.onSubAgentSuspend) {
              await parentManifest.hooks.onSubAgentSuspend(subCtx, {
                parentManifestId: execCtx.manifestId,
                parentManifestVersion: execCtx.manifestVersion,
                parentStateId: execCtx.stateId,
                childManifestId: subAgentManifest.config.id,
                childManifestVersion: subAgentManifest.config.version,
                childStateId: agentRunResult.runId,
                toolCallId: toolCall.toolCallId,
                suspensions: agentRunResult.suspensions,
              });
            }

            yield ok({
              type: 'sub-agent-end',
              manifestId: execCtx.manifestId,
              parentManifestId: execCtx.parentManifestId,
              timestamp: Date.now(),
              subAgentManifestId: subAgentManifest.config.id,
              subAgentToolName: config.name,
              status: 'suspended',
            });

            return AgentToolResult.suspended(
              agentRunResult.suspensions,
              agentRunResult.runId,
              subAgentManifest.config.id,
              subAgentManifest.config.version,
              agentRunResult.suspensionStacks,
            );
          }

          // Sub-agent error status
          if (agentRunResult.status === 'error') {
            // Call onSubAgentError hook
            if (parentManifest.hooks?.onSubAgentError) {
              await parentManifest.hooks.onSubAgentError(subCtx, {
                parentManifestId: execCtx.manifestId,
                parentManifestVersion: execCtx.manifestVersion,
                parentStateId: execCtx.stateId,
                childManifestId: subAgentManifest.config.id,
                childManifestVersion: subAgentManifest.config.version,
                childStateId: agentRunResult.runId,
                toolCallId: toolCall.toolCallId,
                error: {
                  code: agentRunResult.error.code,
                  message: agentRunResult.error.message,
                },
              });
            }

            yield ok({
              type: 'sub-agent-end',
              manifestId: execCtx.manifestId,
              parentManifestId: execCtx.parentManifestId,
              timestamp: Date.now(),
              subAgentManifestId: subAgentManifest.config.id,
              subAgentToolName: config.name,
              status: 'error',
            });

            return AgentToolResult.error(
              agentRunResult.error.message,
              agentRunResult.error.code,
            );
          }

          // Sub-agent was cancelled
          if (agentRunResult.status === 'cancelled') {
            // Call onSubAgentCancelled hook
            if (parentManifest.hooks?.onSubAgentCancelled) {
              await parentManifest.hooks.onSubAgentCancelled(subCtx, {
                parentManifestId: execCtx.manifestId,
                parentManifestVersion: execCtx.manifestVersion,
                parentStateId: execCtx.stateId,
                childManifestId: subAgentManifest.config.id,
                childManifestVersion: subAgentManifest.config.version,
                childStateId: agentRunResult.runId,
                toolCallId: toolCall.toolCallId,
                reason: 'User cancelled',
              });
            }

            yield ok({
              type: 'sub-agent-end',
              manifestId: execCtx.manifestId,
              parentManifestId: execCtx.parentManifestId,
              timestamp: Date.now(),
              subAgentManifestId: subAgentManifest.config.id,
              subAgentToolName: config.name,
              status: 'error',
            });

            return AgentToolResult.error(
              'Sub-agent execution was cancelled',
              'Cancelled',
            );
          }

          // Sub-agent is already running
          if (agentRunResult.status === 'already-running') {
            yield ok({
              type: 'sub-agent-end',
              manifestId: execCtx.manifestId,
              parentManifestId: execCtx.parentManifestId,
              timestamp: Date.now(),
              subAgentManifestId: subAgentManifest.config.id,
              subAgentToolName: config.name,
              status: 'error',
            });

            return AgentToolResult.error(
              'Sub-agent is already running',
              'AlreadyRunning',
            );
          }

          // Sub-agent completed successfully
          // Call parent's onSubAgentComplete hook
          // Note: We use subCtx which is a full Context derived from the parent's AgentContext
          if (parentManifest.hooks?.onSubAgentComplete) {
            await parentManifest.hooks.onSubAgentComplete(subCtx, {
              parentManifestId: execCtx.manifestId,
              parentManifestVersion: execCtx.manifestVersion,
              parentStateId: execCtx.stateId,
              childManifestId: subAgentManifest.config.id,
              childManifestVersion: subAgentManifest.config.version,
              childStateId: agentRunResult.runId,
              toolCallId: toolCall.toolCallId,
              result: agentRunResult.result,
            });
            // Note: We don't fail on hook errors - the sub-agent already completed
          }

          finalResult = AgentToolResult.success({
            text: agentRunResult.result.text,
            output: agentRunResult.result.output,
          });
          break;
        }

        // item is Result<AgentEvent, AppError>
        // Forward event with updated parentManifestId to show it came from this agent's sub-agent
        if (item.isOk()) {
          yield ok({
            ...item.value,
            // Set parentManifestId to show this event came from a sub-agent of the current agent
            parentManifestId: execCtx.manifestId,
          });
        } else {
          // Forward errors as-is
          yield item;
        }
      }

      // 5. Yield sub-agent-end event for successful completion
      yield ok({
        type: 'sub-agent-end',
        manifestId: execCtx.manifestId,
        parentManifestId: execCtx.parentManifestId,
        timestamp: Date.now(),
        subAgentManifestId: subAgentManifest.config.id,
        subAgentToolName: config.name,
        status: 'complete',
      });

      // 6. Return the final result
      return (
        finalResult ??
        AgentToolResult.error('Sub-agent completed without result', 'NoResult')
      );
    },
  });
}
