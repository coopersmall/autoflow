import { z as zod } from 'zod';

/**
 * Timeout middleware - fails tool execution after timeout.
 */
export const timeoutMiddlewareConfigSchema = zod.strictObject({
  type: zod.literal('timeout'),
  ms: zod.number().positive().describe('Timeout in milliseconds'),
});

export type TimeoutMiddlewareConfig = zod.infer<
  typeof timeoutMiddlewareConfigSchema
>;

/**
 * Retry middleware - retries failed tool executions.
 */
export const retryMiddlewareConfigSchema = zod.strictObject({
  type: zod.literal('retry'),
  maxRetries: zod.number().int().min(1).max(10).default(3),
  retryableErrors: zod
    .array(zod.string())
    .optional()
    .describe(
      'Error codes to retry. If not set, retries all retryable errors.',
    ),
});

export type RetryMiddlewareConfig = zod.infer<
  typeof retryMiddlewareConfigSchema
>;

/**
 * Union of all supported middleware configurations.
 */
export const toolMiddlewareConfigSchema = zod.discriminatedUnion('type', [
  timeoutMiddlewareConfigSchema,
  retryMiddlewareConfigSchema,
]);

export type ToolMiddlewareConfig = zod.infer<typeof toolMiddlewareConfigSchema>;
