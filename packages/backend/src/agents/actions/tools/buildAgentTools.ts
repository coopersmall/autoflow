import type { AgentManifest } from '@backend/agents/domain';
import type { IAgentCancellationCache } from '@backend/agents/infrastructure/cache';
import type { IAgentRunLock } from '@backend/agents/infrastructure/lock';
import type { ICompletionsGateway } from '@backend/ai/completions/domain/CompletionsGateway';
import type { IMCPClient } from '@backend/ai/mcp/domain/MCPClient';
import type { IMCPService } from '@backend/ai/mcp/domain/MCPService';
import type { Context } from '@backend/infrastructure/context/Context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IStorageService } from '@backend/storage/domain/StorageService';
import {
  type AgentExecuteFunction,
  type AgentTool,
  AgentToolResult,
  ManifestKey,
} from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { notFound } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';
import type { IAgentStateCache } from '../../infrastructure/cache';
import { createOutputTool } from './createOutputTool';
import { createStreamingSubAgentTool } from './createStreamingSubAgentTool';

/**
 * Dependencies required for building agent tools.
 * Defined explicitly to avoid circular dependency with StreamAgentDeps.
 */
export interface BuildAgentToolsDeps {
  readonly completionsGateway: ICompletionsGateway;
  readonly mcpService: IMCPService;
  readonly stateCache: IAgentStateCache;
  readonly storageService: IStorageService;
  readonly logger: ILogger;
  readonly agentRunLock: IAgentRunLock;
  readonly cancellationCache: IAgentCancellationCache;
}

export interface BuildAgentToolsResult {
  readonly tools: AgentTool[];
  readonly toolsMap: Map<string, AgentTool>;
  /**
   * Cleanup function to close MCP clients after agent execution completes.
   * Should be called in a finally block to ensure resources are released.
   * Logs errors but does not throw - cleanup is best-effort.
   */
  readonly cleanup: () => Promise<void>;
}

/**
 * Builds the complete tool set for an agent execution.
 * Merges manifest tools, MCP tools (wrapped), sub-agent tools, and output tool.
 * Returns tools, toolsMap, and a cleanup function for MCP client lifecycle.
 *
 * @param ctx - The request context
 * @param manifest - The agent manifest configuration
 * @param manifestMap - Map of all available manifests for sub-agent resolution
 * @param deps - Dependencies including MCP service, logger, etc.
 * @returns Tools, toolsMap, and cleanup function for resource management
 */
export async function buildAgentTools(
  ctx: Context,
  manifest: AgentManifest,
  manifestMap: Map<ManifestKey, AgentManifest>,
  deps: BuildAgentToolsDeps,
): Promise<Result<BuildAgentToolsResult, AppError>> {
  const tools: AgentTool[] = [];
  const mcpClients: IMCPClient[] = [];

  /**
   * Closes all MCP clients, logging any errors encountered.
   * This is a best-effort cleanup - errors do not propagate.
   */
  const cleanup = async (): Promise<void> => {
    for (const client of mcpClients) {
      const closeResult = await client.close();
      if (closeResult.isErr()) {
        deps.logger.error('Failed to close MCP client', closeResult.error, {
          clientId: client.id,
          clientName: client.name,
        });
      }
    }
  };

  // Add manifest tools with executors from hooks
  for (const tool of manifest.config.tools ?? []) {
    const agentExecute = manifest.hooks?.toolExecutors?.[tool.function.name];
    const execute = agentExecute;
    tools.push({ ...tool, execute });
  }

  // Add MCP tools (wrapped to return AgentToolResult)
  for (const serverConfig of manifest.config.mcpServers ?? []) {
    const clientResult = await deps.mcpService.createClient(serverConfig);
    if (clientResult.isErr()) {
      // Close any already-created clients before returning error
      await cleanup();
      return err(clientResult.error);
    }

    const client = clientResult.value;
    mcpClients.push(client);

    const mcpToolsResult = await client.tools();
    if (mcpToolsResult.isErr()) {
      // Close all clients (including this one) before returning error
      await cleanup();
      return err(mcpToolsResult.error);
    }

    // Wrap each MCP tool to return AgentToolResult
    // NOTE: try-catch is intentional here - MCP SDK may throw exceptions.
    // This is an exception to the "no throw" rule for external library boundaries.
    const wrappedMcpTools = mcpToolsResult.value.map((mcpTool) => {
      const originalExecute = mcpTool.execute;
      const wrappedExecute: AgentExecuteFunction = async (
        toolCtx,
        input,
        context,
      ) => {
        try {
          const result = await originalExecute(toolCtx, input, {
            messages: context.messages,
          });
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
  }

  // Add sub-agent tools (framework-managed)
  for (const subAgentConfig of manifest.config.subAgents ?? []) {
    const subAgentKey = ManifestKey({
      id: subAgentConfig.manifestId,
      version: subAgentConfig.manifestVersion,
    });
    const subAgentManifest = manifestMap.get(subAgentKey);

    if (!subAgentManifest) {
      // Close MCP clients before returning error
      await cleanup();
      return err(
        notFound('Sub-agent manifest not found', {
          metadata: {
            manifestId: subAgentConfig.manifestId,
            manifestVersion: subAgentConfig.manifestVersion,
          },
        }),
      );
    }

    const mapper = manifest.hooks?.subAgentMappers?.[subAgentConfig.name];
    const subAgentTool = createStreamingSubAgentTool(
      subAgentConfig,
      manifest,
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

  return ok({ tools, toolsMap, cleanup });
}
