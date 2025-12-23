import zod from 'zod';

/**
 * HTTP transport configuration for MCP connections.
 * Recommended for production deployments.
 */
export const httpTransportConfigSchema = zod.strictObject({
  type: zod.literal('http'),
  url: zod.string().url().describe('The URL of the MCP server'),
  headers: zod
    .record(zod.string())
    .optional()
    .describe('Optional HTTP headers for authentication'),
});

export type HttpTransportConfig = zod.infer<typeof httpTransportConfigSchema>;

/**
 * SSE transport configuration for MCP connections.
 * Alternative HTTP-based transport.
 */
export const sseTransportConfigSchema = zod.strictObject({
  type: zod.literal('sse'),
  url: zod.string().url().describe('The URL of the MCP SSE endpoint'),
  headers: zod
    .record(zod.string())
    .optional()
    .describe('Optional HTTP headers for authentication'),
});

export type SSETransportConfig = zod.infer<typeof sseTransportConfigSchema>;

/**
 * Stdio transport configuration for local MCP servers.
 * Should only be used for local development.
 */
export const stdioTransportConfigSchema = zod.strictObject({
  type: zod.literal('stdio'),
  command: zod.string().describe('The command to run the MCP server'),
  args: zod
    .array(zod.string())
    .optional()
    .describe('Arguments to pass to the command'),
  env: zod
    .record(zod.string())
    .optional()
    .describe('Environment variables for the process'),
});

export type StdioTransportConfig = zod.infer<typeof stdioTransportConfigSchema>;

/**
 * Union of all supported transport configurations.
 */
export const mcpTransportConfigSchema = zod.discriminatedUnion('type', [
  httpTransportConfigSchema,
  sseTransportConfigSchema,
  stdioTransportConfigSchema,
]);

export type MCPTransportConfig = zod.infer<typeof mcpTransportConfigSchema>;

/**
 * Full MCP server configuration.
 */
export const mcpServerConfigSchema = zod.strictObject({
  /** A name for this MCP server (for logging/debugging) */
  name: zod.string().describe('A name for this MCP server'),
  /** Transport configuration */
  transport: mcpTransportConfigSchema,
  /** Optional timeout for operations in milliseconds */
  timeoutMs: zod
    .number()
    .positive()
    .optional()
    .describe('Timeout for MCP operations'),
});

export type MCPServerConfig = zod.infer<typeof mcpServerConfigSchema>;
