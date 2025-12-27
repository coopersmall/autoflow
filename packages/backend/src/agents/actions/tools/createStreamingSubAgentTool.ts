import {
  type AgentManifest,
  type AgentRequest,
  AgentToolResult,
  type AgentToolWithStreamingContext,
  defaultSubAgentArgsSchema,
  type SubAgentConfig,
} from '@core/domain/agents';
import { validate } from '@core/validation/validate';
import type { JSONSchema7 } from 'ai';
import { ok } from 'neverthrow';
import {
  type StreamAgentDeps,
  type StreamAgentFinalResult,
  type StreamAgentItem,
  streamAgent,
} from '../streamAgent';
import { createSubAgentContext } from './createSubAgentContext';

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
 * - Returning AgentToolResult (success, error, or suspended)
 */
export function createStreamingSubAgentTool(
  config: SubAgentConfig,
  subAgentManifest: AgentManifest,
  mapper: ((args: unknown) => AgentRequest) | undefined,
  manifestMap: Map<string, AgentManifest>,
  deps: CreateStreamingSubAgentToolDeps,
): AgentToolWithStreamingContext {
  return {
    type: 'function',
    function: {
      name: config.name,
      description: config.description,
      parameters: config.parameters ?? defaultParameters,
    },
    executeStreamingWithContext: async function* (tool, toolCall, execCtx) {
      // 1. Map args to AgentRequest using mapper from hooks or default with validation
      let agentRequest: AgentRequest;

      if (mapper) {
        agentRequest = mapper(toolCall.input);
      } else {
        // Validate args against default schema
        const argsResult = validate(defaultSubAgentArgsSchema, toolCall.input);
        if (argsResult.isErr()) {
          return AgentToolResult.error(
            `Invalid sub-agent arguments: ${argsResult.error.message}`,
            'ValidationError',
          );
        }
        agentRequest = {
          prompt: argsResult.value.prompt,
          context: argsResult.value.context,
        };
      }

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

      for await (const item of streamAgent(
        subCtx,
        subAgentManifest,
        { type: 'request', request: agentRequest, manifestMap },
        deps,
      )) {
        // Check for final result (StreamAgentFinalResult)
        if (isFinalResult(item)) {
          if (item.result.isErr()) {
            // Sub-agent had an error - yield end event and return error
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

          // Sub-agent completed successfully
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
  };
}
