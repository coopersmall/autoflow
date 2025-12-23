import type { ISharedCache } from '@backend/infrastructure/cache/SharedCache';
import type { UploadState, UploadStateId } from './UploadState';

export type IUploadStateCache = ISharedCache<UploadStateId, UploadState>;
