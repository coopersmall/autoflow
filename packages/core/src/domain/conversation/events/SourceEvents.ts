import zod from 'zod';

// === SOURCE EVENT DATA ===

export const sourceEventDataSchema = zod.strictObject({
  id: zod.string(),
  type: zod.literal('source'),
  title: zod.string().optional(),
  content: zod.discriminatedUnion('sourceType', [
    zod.strictObject({
      sourceType: zod.literal('url'),
      url: zod.string(),
    }),
    zod.strictObject({
      sourceType: zod.literal('document'),
      mediaType: zod.string(),
      filename: zod.string().optional(),
    }),
  ]),
});
