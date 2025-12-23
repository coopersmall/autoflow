import zod from 'zod';

/**
 * An MCP resource descriptor.
 */
export const mcpResourceSchema = zod.strictObject({
  uri: zod.string().describe('The URI of the resource'),
  name: zod.string().describe('Human-readable name'),
  description: zod.string().optional().describe('Description of the resource'),
  mimeType: zod.string().optional().describe('MIME type of the resource'),
});

export type MCPResource = zod.infer<typeof mcpResourceSchema>;

/**
 * Content of an MCP resource.
 */
export const mcpResourceContentSchema = zod.strictObject({
  uri: zod.string().describe('The URI of the resource'),
  mimeType: zod.string().optional().describe('MIME type of the content'),
  text: zod.string().optional().describe('Text content'),
  blob: zod.string().optional().describe('Base64-encoded binary content'),
});

export type MCPResourceContent = zod.infer<typeof mcpResourceContentSchema>;
