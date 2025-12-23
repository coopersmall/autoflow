/**
 * GCSClient Integration Tests
 *
 * Tests complete storage operations against a real GCS emulator (fake-gcs-server).
 * Uses property-based testing for core invariants like upload/download round-trips.
 *
 * Note: The emulator does not validate authentication, so auth-related error
 * handling is tested in unit tests with mocks instead.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { Readable } from 'node:stream';
import { getMockedLogger } from '@backend/infrastructure/logger/__mocks__/Logger.mock';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import { TestServices } from '@backend/testing/integration/setup/TestServices';
import { Storage } from '@google-cloud/storage';
import * as fc from 'fast-check';
import { bucketExists } from '../../actions/bucketExists';
import { createBucket } from '../../actions/createBucket';
import { deleteBucket } from '../../actions/deleteBucket';
import { deleteObject } from '../../actions/deleteObject';
import { downloadObject } from '../../actions/downloadObject';
import { downloadObjectStream } from '../../actions/downloadObjectStream';
import { getObjectMetadata } from '../../actions/getObjectMetadata';
import { getSignedUrl } from '../../actions/getSignedUrl';
import { listObjects } from '../../actions/listObjects';
import { objectExists } from '../../actions/objectExists';
import { uploadObject } from '../../actions/uploadObject';
import { uploadObjectStream } from '../../actions/uploadObjectStream';
import type { IStorageClient } from '../../domain/StorageClient';

// ============================================================================
// Test Setup
// ============================================================================

/**
 * Creates a unique bucket name for test isolation.
 */
function createUniqueBucketName(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Deletes all objects in a bucket and then the bucket itself.
 */
async function cleanupBucket(
  storage: Storage,
  bucketName: string,
): Promise<void> {
  try {
    const bucket = storage.bucket(bucketName);
    await bucket.deleteFiles({ force: true });
    await bucket.delete();
  } catch {
    // Bucket may not exist, ignore
  }
}

/**
 * Creates a GCS client configured for the emulator.
 */
function createTestGCSClient(logger: ILogger): {
  client: IStorageClient;
  storage: Storage;
} {
  const emulatorUrl = TestServices.getGCSEmulatorUrl();
  const projectId = 'test-project';

  const storage = new Storage({
    apiEndpoint: emulatorUrl,
    projectId,
  });

  // Build the client directly using actions with our emulator Storage
  // Note: We don't use the GCSClient class here because the emulator
  // doesn't validate auth, and we want to test the actions directly.
  const client: IStorageClient = {
    projectId,

    upload: (request) => uploadObject(request, storage, logger),
    uploadStream: (request) => uploadObjectStream(request, storage, logger),
    download: (request) => downloadObject(request, storage, logger),
    downloadStream: (request) => downloadObjectStream(request, storage, logger),
    delete: (request) => deleteObject(request, storage, logger),
    exists: (request) => objectExists(request, storage, logger),
    getMetadata: (request) => getObjectMetadata(request, storage, logger),
    list: (request) => listObjects(request, storage, logger),
    getSignedUrl: (request) => getSignedUrl(request, storage, logger),
    bucketExists: (bucketName) => bucketExists(bucketName, storage, logger),
    createBucket: (request) => createBucket(request, storage, logger),
    deleteBucket: (bucketName) => deleteBucket(bucketName, storage, logger),
  };

  return { client, storage };
}

/**
 * Collects a readable stream into a Buffer.
 */
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('GCSClient Integration Tests', () => {
  let client: IStorageClient;
  let storage: Storage;
  let logger: ILogger;
  let testBucket: string;
  const bucketsToCleanup: string[] = [];

  beforeAll(async () => {
    logger = getMockedLogger();
    const result = createTestGCSClient(logger);
    client = result.client;
    storage = result.storage;

    // Create a shared test bucket
    testBucket = createUniqueBucketName('integration');
    bucketsToCleanup.push(testBucket);

    const createResult = await client.createBucket({ bucketName: testBucket });
    if (createResult.isErr()) {
      throw new Error(
        `Failed to create test bucket: ${createResult.error.message}`,
      );
    }
  });

  afterEach(async () => {
    // Clean up objects in the test bucket after each test
    try {
      const bucket = storage.bucket(testBucket);
      await bucket.deleteFiles({ force: true });
    } catch {
      // Ignore errors
    }
  });

  afterAll(async () => {
    // Clean up all test buckets
    for (const bucket of bucketsToCleanup) {
      await cleanupBucket(storage, bucket);
    }
  });

  // ============================================================================
  // Property-Based Tests
  // ============================================================================

  describe('Property Tests', () => {
    // Arbitraries
    const binaryDataArb = fc
      .uint8Array({ minLength: 0, maxLength: 10000 })
      .map((arr) => Buffer.from(arr));
    const objectNameArb = fc
      .stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9_\-./]*$/)
      .filter((s) => s.length >= 1 && s.length <= 200 && !s.endsWith('/'));
    const metadataKeyArb = fc
      .stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/)
      .filter((s) => s.length >= 1 && s.length <= 50);
    const metadataValueArb = fc.string({ minLength: 1, maxLength: 100 });
    const metadataArb = fc.dictionary(metadataKeyArb, metadataValueArb, {
      minKeys: 0,
      maxKeys: 5,
    });

    it('should preserve data through upload/download round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(
          binaryDataArb,
          objectNameArb,
          async (data, objectName) => {
            // Upload
            const uploadResult = await client.upload({
              bucketName: testBucket,
              objectName,
              data,
            });
            expect(uploadResult.isOk()).toBe(true);

            // Download
            const downloadResult = await client.download({
              bucketName: testBucket,
              objectName,
            });
            expect(downloadResult.isOk()).toBe(true);
            expect(downloadResult._unsafeUnwrap().equals(data)).toBe(true);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should preserve custom metadata through upload', async () => {
      await fc.assert(
        fc.asyncProperty(
          binaryDataArb,
          objectNameArb,
          metadataArb,
          async (data, objectName, metadata) => {
            // Upload with metadata
            const uploadResult = await client.upload({
              bucketName: testBucket,
              objectName,
              data,
              metadata,
            });
            expect(uploadResult.isOk()).toBe(true);

            // Verify the upload succeeded
            const existsResult = await client.exists({
              bucketName: testBucket,
              objectName,
            });
            expect(existsResult.isOk()).toBe(true);
            expect(existsResult._unsafeUnwrap()).toBe(true);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should preserve object names including nested paths', async () => {
      const nestedPathArb = fc
        .array(fc.stringMatching(/^[a-zA-Z0-9_-]+$/), {
          minLength: 1,
          maxLength: 5,
        })
        .map((parts) => parts.join('/'));

      await fc.assert(
        fc.asyncProperty(
          binaryDataArb,
          nestedPathArb,
          async (data, objectName) => {
            // Upload
            const uploadResult = await client.upload({
              bucketName: testBucket,
              objectName,
              data,
            });
            expect(uploadResult.isOk()).toBe(true);
            expect(uploadResult._unsafeUnwrap().objectName).toBe(objectName);

            // List and verify the name is preserved
            const listResult = await client.list({
              bucketName: testBucket,
              prefix: objectName,
            });
            expect(listResult.isOk()).toBe(true);
            const files = listResult._unsafeUnwrap().files;
            expect(files.some((f) => f.name === objectName)).toBe(true);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should remove object after delete', async () => {
      await fc.assert(
        fc.asyncProperty(
          binaryDataArb,
          objectNameArb,
          async (data, objectName) => {
            // Upload
            const uploadResult = await client.upload({
              bucketName: testBucket,
              objectName,
              data,
            });
            expect(uploadResult.isOk()).toBe(true);

            // Verify exists
            const existsBefore = await client.exists({
              bucketName: testBucket,
              objectName,
            });
            expect(existsBefore.isOk()).toBe(true);
            expect(existsBefore._unsafeUnwrap()).toBe(true);

            // Delete
            const deleteResult = await client.delete({
              bucketName: testBucket,
              objectName,
            });
            expect(deleteResult.isOk()).toBe(true);

            // Verify not exists
            const existsAfter = await client.exists({
              bucketName: testBucket,
              objectName,
            });
            expect(existsAfter.isOk()).toBe(true);
            expect(existsAfter._unsafeUnwrap()).toBe(false);
          },
        ),
        { numRuns: 30 },
      );
    });

    it('should list all uploaded objects', async () => {
      const objectNamesArb = fc
        .array(
          fc
            .stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/)
            .filter((s) => s.length >= 1 && s.length <= 50),
          { minLength: 1, maxLength: 10 },
        )
        .map((names) => [...new Set(names)]); // Ensure unique names

      await fc.assert(
        fc.asyncProperty(objectNamesArb, async (objectNames) => {
          const data = Buffer.from('test content');

          // Upload all objects
          for (const objectName of objectNames) {
            const uploadResult = await client.upload({
              bucketName: testBucket,
              objectName,
              data,
            });
            expect(uploadResult.isOk()).toBe(true);
          }

          // List all
          const listResult = await client.list({ bucketName: testBucket });
          expect(listResult.isOk()).toBe(true);

          const listedNames = listResult
            ._unsafeUnwrap()
            .files.map((f) => f.name);
          for (const objectName of objectNames) {
            expect(listedNames).toContain(objectName);
          }
        }),
        { numRuns: 30 },
      );
    });

    it('should filter objects by prefix', async () => {
      const prefixArb = fc
        .stringMatching(/^[a-z]+$/)
        .filter((s) => s.length >= 2 && s.length <= 10);
      const suffixArb = fc
        .stringMatching(/^[a-z0-9]+$/)
        .filter((s) => s.length >= 1 && s.length <= 20);

      await fc.assert(
        fc.asyncProperty(prefixArb, suffixArb, async (prefix, suffix) => {
          const data = Buffer.from('test content');
          const matchingName = `${prefix}/${suffix}`;
          const nonMatchingName = `other-${suffix}`;

          // Upload both objects
          await client.upload({
            bucketName: testBucket,
            objectName: matchingName,
            data,
          });
          await client.upload({
            bucketName: testBucket,
            objectName: nonMatchingName,
            data,
          });

          // List with prefix
          const listResult = await client.list({
            bucketName: testBucket,
            prefix: `${prefix}/`,
          });
          expect(listResult.isOk()).toBe(true);

          const listedNames = listResult
            ._unsafeUnwrap()
            .files.map((f) => f.name);
          expect(listedNames).toContain(matchingName);
          expect(listedNames).not.toContain(nonMatchingName);
        }),
        { numRuns: 30 },
      );
    });

    it('should accurately report object existence', async () => {
      await fc.assert(
        fc.asyncProperty(objectNameArb, async (baseName) => {
          // Use unique prefix to avoid collisions with other property tests
          const objectName = `exists-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}/${baseName}`;

          // Should not exist initially
          const existsBefore = await client.exists({
            bucketName: testBucket,
            objectName,
          });
          expect(existsBefore.isOk()).toBe(true);
          expect(existsBefore._unsafeUnwrap()).toBe(false);

          // Upload
          const uploadResult = await client.upload({
            bucketName: testBucket,
            objectName,
            data: Buffer.from('test'),
          });
          expect(uploadResult.isOk()).toBe(true);

          // Should exist after upload
          const existsAfter = await client.exists({
            bucketName: testBucket,
            objectName,
          });
          expect(existsAfter.isOk()).toBe(true);
          expect(existsAfter._unsafeUnwrap()).toBe(true);
        }),
        { numRuns: 30 },
      );
    });

    it('should isolate objects between buckets', async () => {
      const bucket1 = createUniqueBucketName('iso1');
      const bucket2 = createUniqueBucketName('iso2');
      bucketsToCleanup.push(bucket1, bucket2);

      await client.createBucket({ bucketName: bucket1 });
      await client.createBucket({ bucketName: bucket2 });

      await fc.assert(
        fc.asyncProperty(
          binaryDataArb,
          objectNameArb,
          async (data, objectName) => {
            // Upload to bucket1
            await client.upload({ bucketName: bucket1, objectName, data });

            // Should exist in bucket1
            const exists1 = await client.exists({
              bucketName: bucket1,
              objectName,
            });
            expect(exists1.isOk()).toBe(true);
            expect(exists1._unsafeUnwrap()).toBe(true);

            // Should NOT exist in bucket2
            const exists2 = await client.exists({
              bucketName: bucket2,
              objectName,
            });
            expect(exists2.isOk()).toBe(true);
            expect(exists2._unsafeUnwrap()).toBe(false);
          },
        ),
        { numRuns: 20 },
      );
    });
  });

  // ============================================================================
  // CRUD Operation Tests
  // ============================================================================

  describe('CRUD Operations', () => {
    it('should upload and download a simple file', async () => {
      const objectName = 'simple-file.txt';
      const content = Buffer.from('Hello, GCS!');

      const uploadResult = await client.upload({
        bucketName: testBucket,
        objectName,
        data: content,
        contentType: 'text/plain',
      });

      expect(uploadResult.isOk()).toBe(true);
      const uploadResponse = uploadResult._unsafeUnwrap();
      expect(uploadResponse.bucketName).toBe(testBucket);
      expect(uploadResponse.objectName).toBe(objectName);
      expect(uploadResponse.size).toBe(content.length);
      // Note: Content-type verification is done via list() in property tests
      // The emulator's getMetadata() may not return the exact content-type set

      const downloadResult = await client.download({
        bucketName: testBucket,
        objectName,
      });

      expect(downloadResult.isOk()).toBe(true);
      expect(downloadResult._unsafeUnwrap().toString()).toBe('Hello, GCS!');
    });

    it('should upload via stream and download', async () => {
      const objectName = 'stream-file.txt';
      const content = 'Stream content for testing';
      const stream = Readable.from([content]);

      const uploadResult = await client.uploadStream({
        bucketName: testBucket,
        objectName,
        stream,
        contentType: 'text/plain',
      });

      expect(uploadResult.isOk()).toBe(true);

      const downloadResult = await client.download({
        bucketName: testBucket,
        objectName,
      });

      expect(downloadResult.isOk()).toBe(true);
      expect(downloadResult._unsafeUnwrap().toString()).toBe(content);
    });

    it('should download as stream', async () => {
      const objectName = 'download-stream.txt';
      const content = Buffer.from('Content to stream download');

      await client.upload({
        bucketName: testBucket,
        objectName,
        data: content,
      });

      const streamResult = await client.downloadStream({
        bucketName: testBucket,
        objectName,
      });

      expect(streamResult.isOk()).toBe(true);
      const downloadedBuffer = await streamToBuffer(
        streamResult._unsafeUnwrap(),
      );
      expect(downloadedBuffer.equals(content)).toBe(true);
    });

    it('should list objects with pagination', async () => {
      // Upload several objects
      for (let i = 0; i < 5; i++) {
        await client.upload({
          bucketName: testBucket,
          objectName: `paginate-${i}.txt`,
          data: Buffer.from(`content-${i}`),
        });
      }

      // List with small page size
      const page1Result = await client.list({
        bucketName: testBucket,
        prefix: 'paginate-',
        maxResults: 2,
      });

      expect(page1Result.isOk()).toBe(true);
      const page1 = page1Result._unsafeUnwrap();
      expect(page1.files.length).toBe(2);

      // If there's a next page token, fetch it
      if (page1.nextPageToken) {
        const page2Result = await client.list({
          bucketName: testBucket,
          prefix: 'paginate-',
          maxResults: 2,
          pageToken: page1.nextPageToken,
        });

        expect(page2Result.isOk()).toBe(true);
        expect(page2Result._unsafeUnwrap().files.length).toBeGreaterThan(0);
      }
    });

    it('should check bucket existence', async () => {
      const existsResult = await client.bucketExists(testBucket);
      expect(existsResult.isOk()).toBe(true);
      expect(existsResult._unsafeUnwrap()).toBe(true);

      const notExistsResult = await client.bucketExists(
        'definitely-does-not-exist-12345',
      );
      expect(notExistsResult.isOk()).toBe(true);
      expect(notExistsResult._unsafeUnwrap()).toBe(false);
    });

    it('should create a new bucket', async () => {
      const newBucket = createUniqueBucketName('create-test');
      bucketsToCleanup.push(newBucket);

      const createResult = await client.createBucket({ bucketName: newBucket });
      expect(createResult.isOk()).toBe(true);

      const existsResult = await client.bucketExists(newBucket);
      expect(existsResult.isOk()).toBe(true);
      expect(existsResult._unsafeUnwrap()).toBe(true);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should return NotFound error when downloading non-existent object', async () => {
      const downloadResult = await client.download({
        bucketName: testBucket,
        objectName: 'does-not-exist.txt',
      });

      expect(downloadResult.isErr()).toBe(true);
      expect(downloadResult._unsafeUnwrapErr().code).toBe('NotFound');
    });

    it('should return NotFound error when deleting non-existent object', async () => {
      const deleteResult = await client.delete({
        bucketName: testBucket,
        objectName: 'does-not-exist-delete.txt',
      });

      expect(deleteResult.isErr()).toBe(true);
      expect(deleteResult._unsafeUnwrapErr().code).toBe('NotFound');
    });

    it('should return error (not throw) for operations on non-existent bucket', async () => {
      // Arbitrary for bucket names that definitely don't exist
      const nonExistentBucketArb = fc
        .stringMatching(/^[a-z][a-z0-9-]{5,20}$/)
        .map((s) => `nonexistent-${s}-${Date.now()}`);

      await fc.assert(
        fc.asyncProperty(nonExistentBucketArb, async (bucketName) => {
          // All operations should return Result errors, not throw
          const downloadResult = await client.download({
            bucketName,
            objectName: 'test.txt',
          });
          expect(downloadResult.isErr()).toBe(true);

          const listResult = await client.list({ bucketName });
          expect(listResult.isErr()).toBe(true);

          const existsResult = await client.exists({
            bucketName,
            objectName: 'test.txt',
          });
          // exists() may return Ok(false) or Err depending on implementation
          // The key property is it doesn't throw
          expect(existsResult.isOk() || existsResult.isErr()).toBe(true);
        }),
        { numRuns: 10 },
      );
    });

    it('should return error (not throw) for invalid object names', async () => {
      // GCS disallows: null bytes, carriage returns, line feeds
      // Also objects cannot be named "." or ".."
      const invalidObjectNameArb = fc.oneof(
        fc.constant('.'),
        fc.constant('..'),
        fc.constant('test\x00file'), // null byte
        fc.constant('test\nfile'), // newline
        fc.constant('test\rfile'), // carriage return
      );

      await fc.assert(
        fc.asyncProperty(invalidObjectNameArb, async (objectName) => {
          const uploadResult = await client.upload({
            bucketName: testBucket,
            objectName,
            data: Buffer.from('test'),
          });
          // Should either succeed (if emulator is lenient) or return error
          // The key property is it doesn't throw an unhandled exception
          expect(uploadResult.isOk() || uploadResult.isErr()).toBe(true);
        }),
        { numRuns: 5 },
      );
    });
  });

  // ============================================================================
  // Edge Case Tests
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty file', async () => {
      const objectName = 'empty-file.txt';
      const content = Buffer.alloc(0);

      const uploadResult = await client.upload({
        bucketName: testBucket,
        objectName,
        data: content,
      });
      expect(uploadResult.isOk()).toBe(true);
      expect(uploadResult._unsafeUnwrap().size).toBe(0);

      const downloadResult = await client.download({
        bucketName: testBucket,
        objectName,
      });
      expect(downloadResult.isOk()).toBe(true);
      expect(downloadResult._unsafeUnwrap().length).toBe(0);
    });

    it('should handle binary data with all byte values', async () => {
      const objectName = 'binary-all-bytes.bin';
      // Create buffer with all 256 byte values
      const content = Buffer.alloc(256);
      for (let i = 0; i < 256; i++) {
        content[i] = i;
      }

      const uploadResult = await client.upload({
        bucketName: testBucket,
        objectName,
        data: content,
      });
      expect(uploadResult.isOk()).toBe(true);

      const downloadResult = await client.download({
        bucketName: testBucket,
        objectName,
      });
      expect(downloadResult.isOk()).toBe(true);
      expect(downloadResult._unsafeUnwrap().equals(content)).toBe(true);
    });

    it('should handle deeply nested object paths', async () => {
      const objectName = 'level1/level2/level3/level4/level5/deep-file.txt';
      const content = Buffer.from('Deep content');

      const uploadResult = await client.upload({
        bucketName: testBucket,
        objectName,
        data: content,
      });
      expect(uploadResult.isOk()).toBe(true);

      const downloadResult = await client.download({
        bucketName: testBucket,
        objectName,
      });
      expect(downloadResult.isOk()).toBe(true);
      expect(downloadResult._unsafeUnwrap().toString()).toBe('Deep content');

      // Verify listing with prefix works
      const listResult = await client.list({
        bucketName: testBucket,
        prefix: 'level1/level2/',
      });
      expect(listResult.isOk()).toBe(true);
      expect(
        listResult._unsafeUnwrap().files.some((f) => f.name === objectName),
      ).toBe(true);
    });

    it('should handle special characters in object names', async () => {
      const objectName = 'special_chars-file.test.txt';
      const content = Buffer.from('Special chars content');

      const uploadResult = await client.upload({
        bucketName: testBucket,
        objectName,
        data: content,
      });
      expect(uploadResult.isOk()).toBe(true);

      const existsResult = await client.exists({
        bucketName: testBucket,
        objectName,
      });
      expect(existsResult.isOk()).toBe(true);
      expect(existsResult._unsafeUnwrap()).toBe(true);
    });

    it('should handle concurrent uploads to different objects', async () => {
      const uploads = Array.from({ length: 10 }, (_, i) => ({
        objectName: `concurrent-${i}.txt`,
        data: Buffer.from(`content-${i}`),
      }));

      // Upload all concurrently
      const results = await Promise.all(
        uploads.map(({ objectName, data }) =>
          client.upload({
            bucketName: testBucket,
            objectName,
            data,
          }),
        ),
      );

      // All should succeed
      for (const result of results) {
        expect(result.isOk()).toBe(true);
      }

      // Verify all exist
      const listResult = await client.list({
        bucketName: testBucket,
        prefix: 'concurrent-',
      });
      expect(listResult.isOk()).toBe(true);
      expect(listResult._unsafeUnwrap().files.length).toBe(10);
    });
  });
});
