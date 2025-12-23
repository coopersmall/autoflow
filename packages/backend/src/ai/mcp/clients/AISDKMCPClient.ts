import type { MCPClient } from '@ai-sdk/mcp';
import type {
  AppError,
  MCPClientId,
  MCPResource,
  MCPResourceContent,
} from '@autoflow/core';
import { err, ok, type Result } from 'neverthrow';
import type { IMCPClient, MCPTool } from '../domain/MCPClient';
import { mcpClientClosedError, mcpResourceError } from '../errors/mcpErrors';
import { closeClient } from './actions/closeClient';
import { getTools } from './actions/getTools';

export interface AISDKMCPClientConfig {
  readonly id: MCPClientId;
  readonly name: string;
  readonly sdkClient: MCPClient;
}

export interface AISDKMCPClientActions {
  readonly getTools: typeof getTools;
  readonly closeClient: typeof closeClient;
}

const defaultActions: AISDKMCPClientActions = {
  getTools,
  closeClient,
};

/**
 * Implementation of IMCPClient that wraps the AI SDK's MCPClient.
 *
 * This class provides the bridge between our domain interface and
 * the AI SDK's MCP implementation.
 */
export class AISDKMCPClient implements IMCPClient {
  readonly id: MCPClientId;
  readonly name: string;

  private readonly sdkClient: MCPClient;
  private readonly actions: AISDKMCPClientActions;
  private closed = false;

  constructor(
    config: AISDKMCPClientConfig,
    actions: AISDKMCPClientActions = defaultActions,
  ) {
    this.id = config.id;
    this.name = config.name;
    this.sdkClient = config.sdkClient;
    this.actions = actions;
  }

  async tools(): Promise<Result<MCPTool[], AppError>> {
    if (this.closed) {
      return err(
        mcpClientClosedError('Cannot get tools: MCP client is closed', {
          metadata: { clientId: this.id, name: this.name },
        }),
      );
    }

    return await this.actions.getTools({
      clientId: this.id,
      clientName: this.name,
      sdkClient: this.sdkClient,
    });
  }

  async listResources(): Promise<Result<MCPResource[], AppError>> {
    if (this.closed) {
      return err(
        mcpClientClosedError('Cannot list resources: MCP client is closed', {
          metadata: { clientId: this.id, name: this.name },
        }),
      );
    }

    try {
      const result = await this.sdkClient.listResources();

      return ok(
        result.resources.map((r) => ({
          uri: r.uri,
          name: r.name,
          description: r.description,
          mimeType: r.mimeType,
        })),
      );
    } catch (error) {
      return err(
        mcpResourceError('Failed to list resources from MCP server', {
          cause: error,
          metadata: { clientId: this.id },
        }),
      );
    }
  }

  async readResource(
    uri: string,
  ): Promise<Result<MCPResourceContent, AppError>> {
    if (this.closed) {
      return err(
        mcpClientClosedError('Cannot read resource: MCP client is closed', {
          metadata: { clientId: this.id, name: this.name, uri },
        }),
      );
    }

    try {
      const result = await this.sdkClient.readResource({ uri });
      if (result.contents.length === 0) {
        return err(
          mcpResourceError('Resource has no contents', {
            uri,
            metadata: { clientId: this.id },
          }),
        );
      }
      const firstContent = result.contents[0];

      // SDK returns text/blob as unknown, we need to handle them carefully
      const text =
        typeof firstContent?.text === 'string' ? firstContent.text : undefined;
      const blob =
        typeof firstContent?.blob === 'string' ? firstContent.blob : undefined;

      return ok({
        uri,
        mimeType: firstContent?.mimeType,
        text,
        blob,
      });
    } catch (error) {
      return err(
        mcpResourceError(`Failed to read resource: ${uri}`, {
          cause: error,
          uri,
          metadata: { clientId: this.id },
        }),
      );
    }
  }

  async close(): Promise<Result<void, AppError>> {
    if (this.closed) {
      return ok(undefined);
    }

    const result = await this.actions.closeClient({
      clientId: this.id,
      clientName: this.name,
      closeConnection: () => this.sdkClient.close(),
    });

    this.closed = true;
    return result;
  }
}
