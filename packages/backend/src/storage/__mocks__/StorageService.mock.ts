import { mock } from 'bun:test';
import type { ExtractMockMethods } from '@core/types';
import type { IStorageService } from '../domain/StorageService';

export function getMockedStorageService(): ExtractMockMethods<IStorageService> {
  return {
    getUploadUrl: mock(),
    upload: mock(),
    uploadStream: mock(),
    getFile: mock(),
    getDownloadUrl: mock(),
    listFiles: mock(),
    deleteFile: mock(),
  };
}
