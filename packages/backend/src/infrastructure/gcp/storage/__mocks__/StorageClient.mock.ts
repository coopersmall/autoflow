import { mock } from 'bun:test';
import type { ExtractMockMethods } from '@core/types';
import { ok } from 'neverthrow';

import type { IStorageClient } from '../domain/StorageClient';
import type {
  GetMetadataResponse,
  ListResponse,
  StorageFileInfo,
  UploadResponse,
} from '../domain/StorageTypes';

/**
 * Creates a mocked Storage Client for unit testing.
 *
 * @param overrides - Optional partial overrides for the mock
 * @returns Mocked IStorageClient with all methods as mock functions
 *
 * @example
 * ```typescript
 * const mockClient = getMockedStorageClient();
 * mockClient.upload.mockResolvedValue(ok(createTestUploadResponse()));
 *
 * const result = await mockClient.upload({
 *   bucketName: 'test-bucket',
 *   objectName: 'test.txt',
 *   data: Buffer.from('hello'),
 * });
 *
 * expect(mockClient.upload).toHaveBeenCalled();
 * ```
 */
export function getMockedStorageClient(
  overrides?: Partial<ExtractMockMethods<IStorageClient>>,
): ExtractMockMethods<IStorageClient> {
  return {
    upload: mock(),
    uploadStream: mock(),
    download: mock(),
    downloadStream: mock(),
    delete: mock(),
    exists: mock(),
    getMetadata: mock(),
    list: mock(),
    getSignedUrl: mock(),
    bucketExists: mock(),
    createBucket: mock(),
    deleteBucket: mock(),
    projectId: 'test-project-id',
    ...overrides,
  };
}

/**
 * Creates a test upload response for use in tests.
 *
 * @param overrides - Optional partial overrides for the response
 * @returns A complete UploadResponse
 */
export function createTestUploadResponse(
  overrides?: Partial<UploadResponse>,
): UploadResponse {
  return {
    bucketName: 'test-bucket',
    objectName: 'test-file.txt',
    size: 1024,
    contentType: 'text/plain',
    etag: 'test-etag-12345',
    generation: '1234567890',
    ...overrides,
  };
}

/**
 * Creates a test file info for use in tests.
 *
 * @param overrides - Optional partial overrides for the file info
 * @returns A complete StorageFileInfo
 */
export function createTestStorageFileInfo(
  overrides?: Partial<StorageFileInfo>,
): StorageFileInfo {
  return {
    name: 'test-file.txt',
    size: 1024,
    contentType: 'text/plain',
    updated: new Date(),
    etag: 'test-etag-12345',
    ...overrides,
  };
}

/**
 * Creates a test metadata response for use in tests.
 *
 * @param overrides - Optional partial overrides for the response
 * @returns A complete GetMetadataResponse
 */
export function createTestGetMetadataResponse(
  overrides?: Partial<GetMetadataResponse>,
): GetMetadataResponse {
  return {
    name: 'test-file.txt',
    size: 1024,
    contentType: 'text/plain',
    updated: new Date(),
    etag: 'test-etag-12345',
    metadata: undefined,
    ...overrides,
  };
}

/**
 * Creates a test list response for use in tests.
 *
 * @param files - Optional array of file infos
 * @param nextPageToken - Optional pagination token
 * @returns A complete ListResponse
 */
export function createTestListResponse(
  files?: StorageFileInfo[],
  nextPageToken?: string,
): ListResponse {
  return {
    files: files ?? [createTestStorageFileInfo()],
    nextPageToken,
  };
}

/**
 * Creates a mock that returns a successful upload response.
 *
 * @param response - Optional response to return (uses default if not provided)
 * @returns Mock function that resolves to ok(response)
 */
export function mockSuccessfulUpload(response?: UploadResponse) {
  const mockResponse = response ?? createTestUploadResponse();
  return mock().mockResolvedValue(ok(mockResponse));
}

/**
 * Creates a mock that returns a successful download.
 *
 * @param content - Content to return as Buffer
 * @returns Mock function that resolves to ok(Buffer)
 */
export function mockSuccessfulDownload(content = 'test content') {
  return mock().mockResolvedValue(ok(Buffer.from(content)));
}

/**
 * Creates a mock that returns successful exists check.
 *
 * @param exists - Whether the object exists
 * @returns Mock function that resolves to ok(exists)
 */
export function mockSuccessfulExists(exists = true) {
  return mock().mockResolvedValue(ok(exists));
}
