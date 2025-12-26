import type { RunAgentDeps } from '@backend/agents/actions/execution/runAgent';
import {
  type AgentManifest,
  type AgentRequest,
  AgentToolResult,
  type AgentToolWithContext,
  defaultSubAgentArgsSchema,
  type SubAgentConfig,
} from '@core/domain/agents';
import { validate } from '@core/validation/validate';
import type { JSONSchema7 } from 'ai';
import { runAgent } from '../execution/runAgent';
import { createSubAgentContext } from './createSubAgentContext';

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
 * - Returning AgentToolResult (success, error, or suspended)
 *
 * Returns an AgentToolWithContext which provides access to the full
 * ToolExecutionContext (including ctx for timeout management).
 */
export function createSubAgentTool(
  config: SubAgentConfig,
  subAgentManifest: AgentManifest,
  mapper: ((args: unknown) => AgentRequest) | undefined,
  manifestMap: Map<string, AgentManifest>,
  deps: CreateSubAgentToolDeps,
): AgentToolWithContext {
  return {
    type: 'function',
    function: {
      name: config.name,
      description: config.description,
      parameters: config.parameters ?? defaultParameters,
    },
    executeWithContext: async (tool, toolCall, execCtx) => {
      // Map args to AgentRequest using mapper from hooks or default with validation
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

      // Create sub-agent context with independent timeout
      const subCtx = createSubAgentContext(execCtx.ctx, config.timeout);

      // Run sub-agent recursively with the same manifestMap
      const result = await runAgent(
        subCtx,
        subAgentManifest,
        {
          type: 'request',
          request: agentRequest,
          manifestMap,
        },
        deps,
      );

      if (result.isErr()) {
        return AgentToolResult.error(result.error.message, result.error.code);
      }

      // Sub-agent suspended - return as AgentToolResult.suspended
      if (result.value.status === 'suspended') {
        return AgentToolResult.suspended(
          result.value.suspensions,
          result.value.runId,
        );
      }

      if (result.value.status === 'error') {
        return AgentToolResult.error(
          result.value.error.message,
          result.value.error.code,
        );
      }

      // Success
      return AgentToolResult.success({
        text: result.value.result.text,
        output: result.value.result.output,
      });
    },
  };
}
