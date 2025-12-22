import type zod from 'zod';
import { createIdSchema, newId } from '../Id';

export type FileAssetId = zod.infer<typeof fileAssetIdSchema>;
export const FileAssetId = newId<FileAssetId>;
export const fileAssetIdSchema = createIdSchema('FileAssetId');
