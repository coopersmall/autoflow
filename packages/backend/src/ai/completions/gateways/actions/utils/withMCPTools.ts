import {
  type AppError,
  internalError,
  type StandardCompletionsRequest,
} from '@autoflow/core';
import type { IMCPClient, IMCPService } from '@backend/ai/mcp';
import { err, ok, type Result } from 'neverthrow';
import { closeMCPClients } from './closeMCPClients';

export interface WithMCPToolsContext {
  readonly request: StandardCompletionsRequest;
  readonly mcpService: IMCPService;
}

export interface WithMCPToolsResult {
  readonly tools: StandardCompletionsRequest['tools'];
  readonly clients: IMCPClient[];
}

/**
 * Retrieves tools from MCP servers and merges with request tools.
 *
 * If request.mcpServers is provided, creates clients, gets tools,
 * and merges them with any existing request.tools.
 *
 * Returns the merged tools and the clients (for cleanup).
 */
export async function withMCPTools(
  ctx: WithMCPToolsContext,
): Promise<Result<WithMCPToolsResult, AppError>> {
  const { request, mcpService } = ctx;
  const { mcpServers, tools: requestTools } = request;

  // No MCP servers configured, return existing tools
  if (!mcpServers || mcpServers.length === 0) {
    return ok({ tools: requestTools, clients: [] });
  }

  const clients: IMCPClient[] = [];
  const allTools = [...(requestTools ?? [])];

  // Create clients and get tools from each server
  for (const serverConfig of mcpServers) {
    const clientResult = await mcpService.createClient(serverConfig);

    if (clientResult.isErr()) {
      // Cleanup already created clients
      const closeResult = await closeMCPClients(clients);
      if (closeResult.isErr()) {
        return err(
          internalError('Failed to create MCP client and cleanup', {
            cause: closeResult.error,
          }),
        );
      }
      return err(clientResult.error);
    }

    const client = clientResult.value;
    clients.push(client);

    const toolsResult = await client.tools();

    if (toolsResult.isErr()) {
      const closeResult = await closeMCPClients(clients);
      if (closeResult.isErr()) {
        return err(
          internalError('Failed to get MCP tools and cleanup', {
            cause: closeResult.error,
          }),
        );
      }
      return err(toolsResult.error);
    }

    allTools.push(...toolsResult.value);
  }

  return ok({
    tools: allTools.length > 0 ? allTools : undefined,
    clients,
  });
}
