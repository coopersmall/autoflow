import zod from 'zod';

export const agentRunOptionsSchema = zod.object({
  agentContentFolder: zod
    .string()
    .optional()
    .describe(
      'Storage folder for agent binary content (e.g., images in conversation history).',
    ),
  agentContentTtlSeconds: zod
    .number()
    .int()
    .positive()
    .optional()
    .describe('TTL for agent binary content in storage.'),
  agentDownloadUrlExpirySeconds: zod
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'Expiry time for signed download URLs generated during deserialization.',
    ),
  agentStateTtl: zod
    .number()
    .int()
    .positive()
    .optional()
    .describe('Default agent execution timeout in milliseconds.'),
  agentTimeout: zod
    .number()
    .int()
    .positive()
    .optional()
    .describe('Default timeout for agent execution in milliseconds.'),
});

export type AgentRunOptions = zod.infer<typeof agentRunOptionsSchema>;
