import zod from 'zod';

export const requestUrlSourcePartSchema = zod.strictObject({
  type: zod.literal('source'),
  sourceType: zod.literal('url'),
  id: zod.string(),
  url: zod.string(),
  title: zod.string().optional(),
});

export const requestDocumentSourcePartSchema = zod.strictObject({
  type: zod.literal('source'),
  sourceType: zod.literal('document'),
  id: zod.string(),
  mediaType: zod.string(),
  title: zod.string().optional(),
  filename: zod.string().optional(),
});
