import type { AgentInput, AgentManifest } from '@backend/agents/domain';
import {
  type AgentRequest,
  AgentToolResult,
  type AgentToolWithContext,
  type ManifestKey,
  type SubAgentConfig,
} from '@core/domain/agents';
import type { JSONSchema7 } from 'ai';
import { type RunAgentDeps, runAgent } from '../runAgent';
import { createSubAgentContext } from './createSubAgentContext';
import { parseSubAgentArgs } from './parseSubAgentArgs';

export interface CreateSubAgentToolDeps extends RunAgentDeps {}

const defaultParameters: JSONSchema7 = {
  type: 'object',
  properties: {
    prompt: { type: 'string', description: 'Task for the sub-agent' },
    context: { type: 'object', description: 'Additional context' },
  },
  required: ['prompt'],
} as const;

/**
 * Creates a tool that executes a sub-agent. This is framework-internal code.
 *
 * Users declare sub-agents via SubAgentConfig (reference by ID).
 * The framework creates the actual tool and handles:
 * - Looking up the sub-agent manifest from the flat registry
 * - Executing the sub-agent via runAgent
 * - Calling parent lifecycle hooks (onSubAgentStart, onSubAgentComplete, etc.)
 * - Returning AgentToolResult (success, error, or suspended)
 *
 * Returns an AgentToolWithContext which provides access to the full
 * ToolExecutionContext (including ctx for timeout management).
 */
export function createSubAgentTool(
  config: SubAgentConfig,
  parentManifest: AgentManifest,
  subAgentManifest: AgentManifest,
  mapper: ((args: unknown) => AgentRequest) | undefined,
  manifestMap: ReadonlyMap<ManifestKey, AgentManifest>,
  deps: CreateSubAgentToolDeps,
): AgentToolWithContext {
  return Object.freeze({
    type: 'function',
    function: {
      name: config.name,
      description: config.description,
      parameters: config.parameters ?? defaultParameters,
    },
    executeWithContext: async (tool, toolCall, execCtx) => {
      // Parse and validate args
      const argsResult = parseSubAgentArgs(toolCall.input, mapper);
      if (argsResult.isErr()) {
        return argsResult.error;
      }
      const agentRequest: AgentRequest = argsResult.value;

      // Create sub-agent context with independent timeout
      const subCtx = createSubAgentContext(execCtx.ctx, config.timeout);

      const input: AgentInput = {
        ...agentRequest,
        manifestMap,
        parentContext: {
          parentManifestId: execCtx.manifestId,
          parentManifestVersion: execCtx.manifestVersion,
          toolCallId: toolCall.toolCallId,
        },
      };

      // Run sub-agent recursively with the same manifestMap
      const result = await runAgent(subCtx, subAgentManifest, input, deps);

      // Handle errors from runAgent itself
      // Note: We don't call onSubAgentError here because we don't have a childStateId
      // (the sub-agent never successfully started). The error is returned directly.
      if (result.isErr()) {
        return AgentToolResult.error(result.error.message, result.error.code);
      }

      const agentRunResult = result.value;
      const childStateId = agentRunResult.runId;

      // Call onSubAgentStart hook now that we have the childStateId
      // Note: In non-streaming mode, we call this after execution since we
      // don't have access to the stateId until the run completes
      if (parentManifest.hooks?.onSubAgentStart) {
        const hookResult = await parentManifest.hooks.onSubAgentStart(subCtx, {
          parentManifestId: execCtx.manifestId,
          parentManifestVersion: execCtx.manifestVersion,
          parentStateId: execCtx.stateId,
          childManifestId: subAgentManifest.config.id,
          childManifestVersion: subAgentManifest.config.version,
          childStateId,
          toolCallId: toolCall.toolCallId,
        });
        if (hookResult.isErr()) {
          return AgentToolResult.error(
            hookResult.error.message,
            hookResult.error.code,
          );
        }
      }

      // Sub-agent suspended
      if (agentRunResult.status === 'suspended') {
        // Call onSubAgentSuspend hook
        if (parentManifest.hooks?.onSubAgentSuspend) {
          const hookResult = await parentManifest.hooks.onSubAgentSuspend(
            subCtx,
            {
              parentManifestId: execCtx.manifestId,
              parentManifestVersion: execCtx.manifestVersion,
              parentStateId: execCtx.stateId,
              childManifestId: subAgentManifest.config.id,
              childManifestVersion: subAgentManifest.config.version,
              childStateId: agentRunResult.runId,
              toolCallId: toolCall.toolCallId,
              suspensions: agentRunResult.suspensions,
            },
          );
          if (hookResult.isErr()) {
            return AgentToolResult.error(
              hookResult.error.message,
              hookResult.error.code,
            );
          }
        }

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
          const hookResult = await parentManifest.hooks.onSubAgentError(
            subCtx,
            {
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
            },
          );
          if (hookResult.isErr()) {
            return AgentToolResult.error(
              hookResult.error.message,
              hookResult.error.code,
            );
          }
        }

        return AgentToolResult.error(
          agentRunResult.error.message,
          agentRunResult.error.code,
        );
      }

      // Sub-agent was cancelled
      if (agentRunResult.status === 'cancelled') {
        // Call onSubAgentCancelled hook
        if (parentManifest.hooks?.onSubAgentCancelled) {
          const hookResult = await parentManifest.hooks.onSubAgentCancelled(
            subCtx,
            {
              parentManifestId: execCtx.manifestId,
              parentManifestVersion: execCtx.manifestVersion,
              parentStateId: execCtx.stateId,
              childManifestId: subAgentManifest.config.id,
              childManifestVersion: subAgentManifest.config.version,
              childStateId: agentRunResult.runId,
              toolCallId: toolCall.toolCallId,
              reason: 'User cancelled',
            },
          );
          if (hookResult.isErr()) {
            return AgentToolResult.error(
              hookResult.error.message,
              hookResult.error.code,
            );
          }
        }

        return AgentToolResult.error(
          'Sub-agent execution was cancelled',
          'Cancelled',
        );
      }

      // Sub-agent is already running
      if (agentRunResult.status === 'already-running') {
        return AgentToolResult.error(
          'Sub-agent is already running',
          'AlreadyRunning',
        );
      }

      // Sub-agent completed successfully
      // Call onSubAgentComplete hook
      if (parentManifest.hooks?.onSubAgentComplete) {
        const hookResult = await parentManifest.hooks.onSubAgentComplete(
          subCtx,
          {
            parentManifestId: execCtx.manifestId,
            parentManifestVersion: execCtx.manifestVersion,
            parentStateId: execCtx.stateId,
            childManifestId: subAgentManifest.config.id,
            childManifestVersion: subAgentManifest.config.version,
            childStateId: agentRunResult.runId,
            toolCallId: toolCall.toolCallId,
            result: agentRunResult.result,
          },
        );
        if (hookResult.isErr()) {
          return AgentToolResult.error(
            hookResult.error.message,
            hookResult.error.code,
          );
        }
      }

      // Success
      return AgentToolResult.success({
        text: agentRunResult.result.text,
        output: agentRunResult.result.output,
      });
    },
  });
}
