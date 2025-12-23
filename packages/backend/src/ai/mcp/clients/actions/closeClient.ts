import type { AppError, MCPClientId } from '@autoflow/core';
import { err, ok, type Result } from 'neverthrow';
import { mcpClientClosedError } from '../../errors/mcpErrors';

export interface CloseClientContext {
  readonly clientId: MCPClientId;
  readonly clientName: string;
  /**
   * Function that closes the SDK client connection.
   * This indirection allows us to avoid importing SDK types directly.
   */
  readonly closeConnection: () => Promise<void>;
}

/**
 * Closes an MCP client connection.
 */
export async function closeClient(
  ctx: CloseClientContext,
): Promise<Result<void, AppError>> {
  const { clientId, clientName, closeConnection } = ctx;

  try {
    await closeConnection();
    return ok(undefined);
  } catch (error) {
    return err(
      mcpClientClosedError('Error occurred while closing MCP client', {
        cause: error,
        metadata: { clientId, clientName },
      }),
    );
  }
}
