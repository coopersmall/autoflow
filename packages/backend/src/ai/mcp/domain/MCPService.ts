import type { AppError, MCPServerConfig } from '@autoflow/core';
import type { Result } from 'neverthrow';
import type { IMCPClient } from './MCPClient';

/**
 * Domain interface for the MCP service.
 *
 * The MCP service is responsible for creating MCP client connections.
 * It does NOT handle pooling - that is the responsibility of the consumer
 * (e.g., PlaywrightMCPPool in browser-worker).
 */
export type IMCPService = Readonly<{
  /**
   * Create a new MCP client connection.
   *
   * @param config - Configuration for the MCP server
   * @returns A Result containing the client or an error
   */
  createClient(config: MCPServerConfig): Promise<Result<IMCPClient, AppError>>;
}>;
