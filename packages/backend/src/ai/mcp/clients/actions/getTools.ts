import type { MCPClient } from '@ai-sdk/mcp';
import type { AppError, ExecuteFunction, MCPClientId } from '@autoflow/core';
import { asSchema, type JSONSchema7, type ModelMessage } from 'ai';
import { err, ok, type Result } from 'neverthrow';
import type { MCPTool } from '../../domain/MCPClient';
import { mcpToolExecutionError } from '../../errors/mcpErrors';

export interface GetToolsContext {
  readonly clientId: MCPClientId;
  readonly clientName: string;
  readonly sdkClient: MCPClient;
}

/**
 * Retrieves tools from an MCP client and converts them to domain format.
 *
 * The AI SDK's mcpClient.tools() returns a McpToolSet (Record<string, McpToolBase>).
 * Each tool has:
 *   - description?: string
 *   - inputSchema: Schema (wrapped JSON Schema)
 *   - execute: function
 *
 * We convert these to our domain ToolWithExecution format.
 */
export async function getTools(
  ctx: GetToolsContext,
): Promise<Result<MCPTool[], AppError>> {
  const { clientId, clientName, sdkClient } = ctx;

  try {
    const sdkTools = await sdkClient.tools();
    const tools = await convertToolSet(sdkTools);
    return ok(tools);
  } catch (error) {
    return err(
      mcpToolExecutionError('Failed to retrieve tools from MCP server', {
        cause: error,
        metadata: { clientId, clientName },
      }),
    );
  }
}

type AISDKMCPToolSet = Awaited<ReturnType<MCPClient['tools']>>;
type AISDKMCPTool = Awaited<ReturnType<MCPClient['tools']>>[string];

/**
 * Converts AI SDK ToolSet to domain ToolWithExecution array.
 *
 * We iterate the tools and build domain ToolWithExecution objects from each.
 * The conversion handles:
 * - Extracting JSON Schema from the inputSchema wrapper
 * - Wrapping the execute function to match our domain signature
 */
async function convertToolSet(sdkTools: AISDKMCPToolSet): Promise<MCPTool[]> {
  const result: MCPTool[] = [];

  for (const [name, sdkTool] of Object.entries(sdkTools)) {
    const tool = await convertTool(name, sdkTool);
    result.push(tool);
  }

  return result;
}

/**
 * Converts a single SDK tool to domain ToolWithExecution.
 */
async function convertTool(
  name: string,
  sdkTool: AISDKMCPTool,
): Promise<MCPTool> {
  // asSchema().jsonSchema can return JSONSchema7 | PromiseLike<JSONSchema7>
  // We need to await it to get the resolved schema
  const schemaOrPromise = asSchema(sdkTool.inputSchema).jsonSchema;
  const parameters: JSONSchema7 = await Promise.resolve(schemaOrPromise);
  return {
    type: 'function',
    function: {
      name,
      description: sdkTool.description ?? '',
      parameters,
    },
    execute: createExecuteWrapper(name, sdkTool),
  };
}

/**
 * Creates an execute wrapper that adapts the SDK tool's execute to our domain signature.
 *
 * Our domain ExecuteFunction: (input, { messages }) => Promise<any>
 * SDK tool execute: (input, ToolExecutionOptions) => Promise<CallToolResult>
 *
 * We create an adapter that:
 * 1. Accepts our simpler domain signature
 * 2. Calls the SDK execute with the required ToolExecutionOptions
 */
function createExecuteWrapper(
  toolName: string,
  sdkTool: AISDKMCPTool,
): ExecuteFunction {
  return async (input: unknown, options: { messages: ModelMessage[] }) => {
    // Generate a unique tool call ID for this execution
    // The MCP server uses this for tracking but doesn't require a specific format
    const toolCallId = `mcp_${toolName}_${Date.now()}`;

    // Call the SDK tool's execute with required ToolExecutionOptions
    const result = await sdkTool.execute(input, {
      toolCallId,
      messages: options.messages,
    });

    return result;
  };
}
