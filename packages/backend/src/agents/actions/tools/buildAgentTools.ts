import type { Context } from '@backend/infrastructure/context/Context';
import {
  type AgentExecuteFunction,
  type AgentManifest,
  type AgentTool,
  AgentToolResult,
} from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { notFound } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';
import type { StreamAgentDeps } from '../streamAgent';
import { createOutputTool } from './createOutputTool';
import { createStreamingSubAgentTool } from './createStreamingSubAgentTool';

export interface BuildAgentToolsDeps extends StreamAgentDeps {
  // All StreamAgentDeps needed for sub-agent recursive calls
}

export interface BuildAgentToolsResult {
  readonly tools: AgentTool[];
  readonly toolsMap: Map<string, AgentTool>;
}

/**
 * Builds the complete tool set for an agent execution.
 * Merges manifest tools, MCP tools (wrapped), sub-agent tools, and output tool.
 * Returns both array and map for efficient lookup.
 */
export async function buildAgentTools(
  ctx: Context,
  manifest: AgentManifest,
  manifestMap: Map<string, AgentManifest>,
  deps: BuildAgentToolsDeps,
): Promise<Result<BuildAgentToolsResult, AppError>> {
  const tools: AgentTool[] = [];

  // Add manifest tools with executors from hooks
  for (const tool of manifest.config.tools ?? []) {
    const agentExecute = manifest.hooks.toolExecutors?.get(tool.function.name);
    const execute = agentExecute;
    tools.push({ ...tool, execute });
  }

  // Add MCP tools (wrapped to return AgentToolResult)
  for (const serverConfig of manifest.config.mcpServers ?? []) {
    const clientResult = await deps.mcpService.createClient(serverConfig);
    if (clientResult.isErr()) {
      return err(clientResult.error);
    }

    const client = clientResult.value;
    const mcpToolsResult = await client.tools();
    if (mcpToolsResult.isErr()) {
      await client.close();
      return err(mcpToolsResult.error);
    }

    // Wrap each MCP tool to return AgentToolResult
    const wrappedMcpTools = mcpToolsResult.value.map((mcpTool) => {
      const originalExecute = mcpTool.execute;
      const wrappedExecute: AgentExecuteFunction = async (input, context) => {
        try {
          // Cast context.messages to the type expected by ExecuteFunction
          const result = await originalExecute(input, {
            messages: context.messages,
          });
          // MCP tools always return success, never suspended
          return AgentToolResult.success(result);
        } catch (e) {
          return AgentToolResult.error(
            e instanceof Error ? e.message : String(e),
            'MCPError',
            true, // MCP errors are typically retryable
          );
        }
      };

      return {
        ...mcpTool,
        execute: wrappedExecute,
      };
    });

    tools.push(...wrappedMcpTools);

    // Note: Client should be closed after agent execution completes
    // For now, we'll leave it to the caller to manage lifecycle
  }

  // Add sub-agent tools (framework-managed)
  for (const subAgentConfig of manifest.config.subAgents ?? []) {
    const subAgentKey = `${subAgentConfig.manifestId}:${subAgentConfig.manifestVersion}`;
    const subAgentManifest = manifestMap.get(subAgentKey);

    if (!subAgentManifest) {
      return err(
        notFound('Sub-agent manifest not found', {
          metadata: {
            manifestId: subAgentConfig.manifestId,
            manifestVersion: subAgentConfig.manifestVersion,
          },
        }),
      );
    }

    const mapper = manifest.hooks.subAgentMappers?.get(subAgentConfig.name);
    const subAgentTool = createStreamingSubAgentTool(
      subAgentConfig,
      subAgentManifest,
      mapper,
      manifestMap,
      deps,
    );
    tools.push(subAgentTool);
  }

  // Add output tool if configured
  if (manifest.config.outputTool) {
    const outputTool = createOutputTool(manifest.config.outputTool);
    tools.push(outputTool);
  }

  // Build map for efficient lookup
  const toolsMap = new Map<string, AgentTool>();
  for (const tool of tools) {
    toolsMap.set(tool.function.name, tool);
  }

  return ok({ tools, toolsMap });
}
