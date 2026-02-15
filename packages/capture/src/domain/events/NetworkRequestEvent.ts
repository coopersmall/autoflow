import { eventIdSchema } from '@capture/domain/EventId';
import zod from 'zod';

export const streamingChunkSchema = zod.object({
  data: zod.string().describe('the chunk data'),
  timestamp: zod.coerce.date().describe('when the chunk was received'),
});
export type StreamingChunk = zod.infer<typeof streamingChunkSchema>;

export const networkRequestEventSchema = zod.object({
  id: eventIdSchema,
  type: zod.literal('network-request'),
  timestamp: zod.coerce.date().describe('when the request was initiated'),
  method: zod.string().describe('HTTP method (GET, POST, etc.)'),
  url: zod.string().describe('the request URL'),
  requestHeaders: zod
    .record(zod.string())
    .optional()
    .describe('request headers'),
  requestBody: zod.string().optional().describe('the request body'),
  status: zod.number().optional().describe('HTTP status code'),
  responseHeaders: zod
    .record(zod.string())
    .optional()
    .describe('response headers'),
  responseBody: zod.string().optional().describe('the response body'),
  streamingChunks: zod
    .array(streamingChunkSchema)
    .optional()
    .describe('streaming response chunks (SSE/ReadableStream)'),
  durationMs: zod
    .number()
    .optional()
    .describe('total request duration in milliseconds'),
  error: zod
    .string()
    .optional()
    .describe('error message if the request failed'),
});
export type NetworkRequestEvent = zod.infer<typeof networkRequestEventSchema>;
