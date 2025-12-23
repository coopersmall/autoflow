import { createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport as StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
import type { AppError, MCPServerConfig } from '@autoflow/core';
import { MCPClientId } from '@autoflow/core';
import { err, ok, type Result } from 'neverthrow';
import type { IMCPClient } from '../../domain/MCPClient';
import { mcpConnectionError } from '../../errors/mcpErrors';
import { AISDKMCPClient } from '../AISDKMCPClient';

export interface CreateClientContext {
  readonly serverConfig: MCPServerConfig;
}

/**
 * Creates an MCP client from configuration.
 *
 * This action uses the @ai-sdk/mcp SDK to establish a connection
 * to an MCP server and wraps it in our domain IMCPClient interface.
 */
export async function createClient(
  ctx: CreateClientContext,
): Promise<Result<IMCPClient, AppError>> {
  const { serverConfig } = ctx;

  try {
    const transport = createTransport(serverConfig);
    const sdkClient = await createMCPClient({ transport });
    const clientId = MCPClientId();

    const client = new AISDKMCPClient({
      id: clientId,
      name: serverConfig.name,
      sdkClient,
    });

    return ok(client);
  } catch (error) {
    return err(
      mcpConnectionError(
        `Failed to connect to MCP server: ${serverConfig.name}`,
        { cause: error },
      ),
    );
  }
}

/**
 * Creates the appropriate transport based on configuration.
 */
function createTransport(config: MCPServerConfig) {
  switch (config.transport.type) {
    case 'http':
      return {
        type: 'http' as const,
        url: config.transport.url,
        headers: config.transport.headers,
      };
    case 'sse':
      return {
        type: 'sse' as const,
        url: config.transport.url,
        headers: config.transport.headers,
      };
    case 'stdio':
      return new StdioMCPTransport({
        command: config.transport.command,
        args: config.transport.args,
        env: config.transport.env,
      });
  }
}
