import zod from 'zod';

export const requestUrlSourcePartSchema = zod.strictObject({
  sourceType: zod.literal('url'),
  id: zod.string(),
  url: zod.string(),
  title: zod.string().optional(),
});

export const requestDocumentSourcePartSchema = zod.strictObject({
  sourceType: zod.literal('document'),
  id: zod.string(),
  mediaType: zod.string(),
  title: zod.string().optional(),
  filename: zod.string().optional(),
});

export const requestSourcePartSchema = zod.strictObject({
  type: zod.literal('source'),
  source: zod.discriminatedUnion('sourceType', [
    requestUrlSourcePartSchema,
    requestDocumentSourcePartSchema,
  ]),
});
