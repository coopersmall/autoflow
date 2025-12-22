import zod from 'zod';
import { fileAssetIdSchema } from '../../file';

export const attachmentSchema = zod.strictObject({
  fileId: fileAssetIdSchema.describe('the file asset ID'),
  mediaType: zod.string().describe('the MIME type'),
});

export type Attachment = zod.infer<typeof attachmentSchema>;
