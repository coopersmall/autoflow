import zod from 'zod';
import { fileAssetIdSchema } from '../../file/FileAssetId';

// === FILE EVENT DATA ===

export const fileGeneratedEventDataSchema = zod.strictObject({
  type: zod.literal('file-generated'),
  id: fileAssetIdSchema.describe('unique identifier for the generated file'),
  mediaType: zod.string().describe('IANA media type of the file'),
});
