import type { AppError, ErrorOptions } from '@autoflow/core';
import { badRequest, internalError } from '@autoflow/core';

/**
 * Error thrown when MCP client connection fails.
 */
export function mcpConnectionError(
  message: string,
  options?: ErrorOptions,
): AppError {
  return internalError(`MCP connection error: ${message}`, options);
}

/**
 * Error thrown when MCP tool execution fails.
 */
export function mcpToolExecutionError(
  message: string,
  options?: ErrorOptions & { toolName?: string },
): AppError {
  return internalError(`MCP tool execution error: ${message}`, {
    ...options,
    metadata: { ...options?.metadata, toolName: options?.toolName },
  });
}

/**
 * Error thrown when MCP resource operation fails.
 */
export function mcpResourceError(
  message: string,
  options?: ErrorOptions & { uri?: string },
): AppError {
  return internalError(`MCP resource error: ${message}`, {
    ...options,
    metadata: { ...options?.metadata, uri: options?.uri },
  });
}

/**
 * Error thrown when MCP client is used after being closed.
 */
export function mcpClientClosedError(
  message: string,
  options?: ErrorOptions,
): AppError {
  return badRequest(`MCP client closed: ${message}`, options);
}
