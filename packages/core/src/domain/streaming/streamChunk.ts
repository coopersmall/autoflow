import zod from 'zod';

const metadataSchema = zod.strictObject({
  timestamp: zod.string().describe('timestamp of the chunk'),
  chunkIndex: zod.number().describe('index of the chunk in the stream'),
});

const streamChunkChunkSchema = zod.strictObject({
  type: zod.literal('chunk'),
  content: zod.unknown().describe('the chunk content'),
  metadata: metadataSchema.optional().describe('optional chunk metadata'),
});

const streamChunkErrorSchema = zod.strictObject({
  type: zod.literal('error'),
  message: zod.string().describe('the error message'),
  metadata: metadataSchema.optional().describe('optional chunk metadata'),
});

const streamChunkCompleteSchema = zod.strictObject({
  type: zod.literal('complete'),
  content: zod.unknown().describe('the final content'),
  metadata: metadataSchema.optional().describe('optional chunk metadata'),
});

export const streamChunkChunkSchemas = [streamChunkChunkSchema] as const;
export const streamChunkErrorSchemas = [streamChunkErrorSchema] as const;
export const streamChunkCompleteSchemas = [streamChunkCompleteSchema] as const;

export const streamChunkSchema = zod.discriminatedUnion('type', [
  ...streamChunkChunkSchemas,
  ...streamChunkErrorSchemas,
  ...streamChunkCompleteSchemas,
]);

export type StreamChunk = Readonly<zod.infer<typeof streamChunkSchema>>;
export type StreamChunkChunk = Readonly<
  zod.infer<typeof streamChunkChunkSchema>
>;
export type StreamChunkError = Readonly<
  zod.infer<typeof streamChunkErrorSchema>
>;
export type StreamChunkComplete = Readonly<
  zod.infer<typeof streamChunkCompleteSchema>
>;
export type StreamChunkMetadata = Readonly<zod.infer<typeof metadataSchema>>;

export const streamChunkTypes = ['chunk', 'error', 'complete'] as const;
export type StreamChunkType = (typeof streamChunkTypes)[number];
