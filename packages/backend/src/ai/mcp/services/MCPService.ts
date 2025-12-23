import type { AppError, MCPServerConfig } from '@autoflow/core';
import type { Result } from 'neverthrow';
import { createClient } from '../clients/actions/createClient';
import type { IMCPClient } from '../domain/MCPClient';
import type { IMCPService } from '../domain/MCPService';

export interface MCPServiceActions {
  readonly createClient: typeof createClient;
}

const defaultActions: MCPServiceActions = {
  createClient,
};

/**
 * Creates an MCP service instance.
 */
export function createMCPService(): IMCPService {
  return Object.freeze(new MCPService());
}

class MCPService implements IMCPService {
  constructor(private readonly actions: MCPServiceActions = defaultActions) {}

  async createClient(
    serverConfig: MCPServerConfig,
  ): Promise<Result<IMCPClient, AppError>> {
    return this.actions.createClient({
      serverConfig,
    });
  }
}
