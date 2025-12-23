import type {
  AppError,
  ExecuteFunction,
  MCPClientId,
  MCPResource,
  MCPResourceContent,
  Tool,
} from '@autoflow/core';
import type { Result } from 'neverthrow';

/**
 * A tool from an MCP server with an execute function attached.
 * Compatible with Tool type from StandardCompletionsRequest.
 */
export interface MCPTool extends Tool {
  execute: ExecuteFunction;
}

/**
 * Domain interface for an MCP client.
 *
 * Provides a clean abstraction over MCP server connections without
 * exposing AI SDK implementation details.
 */
export type IMCPClient = Readonly<{
  /** Unique identifier for this client instance */
  readonly id: MCPClientId;

  /** The name from the configuration */
  readonly name: string;

  /**
   * Get all tools available from the MCP server.
   *
   * Returns tools with execute functions that call the MCP server.
   * These tools can be passed directly to CompletionsService.
   */
  tools(): Promise<Result<MCPTool[], AppError>>;

  /**
   * List all resources available from the MCP server.
   */
  listResources(): Promise<Result<MCPResource[], AppError>>;

  /**
   * Read the content of a specific resource.
   */
  readResource(uri: string): Promise<Result<MCPResourceContent, AppError>>;

  /**
   * Close the connection to the MCP server.
   *
   * Should be called when the client is no longer needed to free resources.
   * After closing, the client should not be used again.
   */
  close(): Promise<Result<void, AppError>>;
}>;
