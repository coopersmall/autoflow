import type { IMCPClient } from '@backend/ai/mcp';
import { type AppError, internalError } from '@core/errors';
import { err, ok, type Result } from 'neverthrow';

export async function closeMCPClients(
  clients: IMCPClient[],
): Promise<Result<void, AppError>> {
  const resuls = await Promise.allSettled(clients.map((c) => c.close()));
  for (const r of resuls) {
    if (r.status === 'rejected') {
      return err(
        internalError('Failed to close MCP clients', {
          cause: r.reason,
        }),
      );
    }
  }
  return ok(undefined);
}
