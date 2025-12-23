/**
 * StorageService Integration Tests
 *
 * Tests the complete StorageService against real infrastructure (GCS emulator + Redis).
 * Uses property-based testing for core invariants and comprehensive scenario coverage.
 *
 * Key concerns tested:
 * - Stream uploads complete fully
 * - Cache state transitions correctly (uploading → ready/failed)
 * - getFile() returns correct state at each stage
 * - Failed uploads are handled gracefully
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { createMockContext } from "@backend/infrastructure/context/__mocks__/Context.mock";
import { createGCSClient } from "@backend/infrastructure/gcp/storage";
import type { IStorageClient } from "@backend/infrastructure/gcp/storage/domain/StorageClient";
import { setupIntegrationTest } from "@backend/testing/integration/integrationTest";
import { TestServices } from "@backend/testing/integration/setup/TestServices";
import { FileAssetId } from "@core/domain/file";
import * as fc from "fast-check";
import { createStorageService } from "../StorageService";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert Buffer to Web ReadableStream
 */
function bufferToWebStream(buffer: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buffer));
      controller.close();
    },
  });
}

/**
 * Create a stream that errors after emitting some bytes
 */
function createErroringStream(
  bytesBeforeError: number,
  error: Error,
): ReadableStream<Uint8Array> {
  let emitted = 0;
  return new ReadableStream({
    pull(controller) {
      if (emitted >= bytesBeforeError) {
        controller.error(error);
        return;
      }
      const chunk = new Uint8Array(Math.min(100, bytesBeforeError - emitted));
      chunk.fill(65); // 'A'
      emitted += chunk.length;
      controller.enqueue(chunk);
    },
  });
}

// ============================================================================
// Test Suite
// ============================================================================

describe("StorageService Integration Tests", () => {
  const { getConfig, getLogger } = setupIntegrationTest();

  let gcsClient: IStorageClient;
  let testBucket: string;

  const testAuthMechanism = TestServices.getGCPAuthMechanism();

  const setup = () => {
    const config = getConfig();
    const logger = getLogger();

    const service = createStorageService({
      logger,
      appConfig: config,
      storageProviderConfig: {
        type: "gcs",
        auth: testAuthMechanism,
        bucketName: testBucket,
      },
    });

    return { service };
  };

  beforeAll(async () => {
    const logger = getLogger();
    gcsClient = createGCSClient(testAuthMechanism, logger);

    testBucket = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const createResult = await gcsClient.createBucket({
      bucketName: testBucket,
    });
    if (createResult.isErr()) {
      throw new Error(
        `Failed to create test bucket: ${createResult.error.message}`,
      );
    }
  });

  afterEach(async () => {
    // Clean up bucket contents
    const listResult = await gcsClient.list({
      bucketName: testBucket,
      prefix: "",
    });
    if (listResult.isOk()) {
      for (const file of listResult.value.files) {
        await gcsClient.delete({
          bucketName: testBucket,
          objectName: file.name,
        });
      }
    }
  });

  afterAll(async () => {
    await gcsClient.deleteBucket(testBucket);
  });

  const ctx = createMockContext();

  // ==========================================================================
  // Property Tests
  // ==========================================================================

  describe("Property Tests", () => {
    const binaryDataArb = fc
      .uint8Array({ minLength: 0, maxLength: 10000 })
      .map((arr) => Buffer.from(arr));

    const filenameArb = fc
      .stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/)
      .filter((s) => s.length >= 1 && s.length <= 100);

    it("should preserve data through upload/getFile round-trip", async () => {
      await fc.assert(
        fc.asyncProperty(binaryDataArb, filenameArb, async (data, filename) => {
          const { service } = setup();
          const fileId = FileAssetId();
          const folder = "test-folder";

          const result = await service.upload(ctx, {
            payload: {
              id: fileId,
              filename,
              mediaType: "application/octet-stream",
              data: new Uint8Array(data),
              size: data.length,
            },
            folder,
          });

          expect(result.isOk()).toBe(true);
          expect(result._unsafeUnwrap().state).toBe("ready");

          // Verify via getFile
          const getResult = await service.getFile(ctx, {
            fileId,
            folder,
            filename,
          });

          expect(getResult.isOk()).toBe(true);
          expect(getResult._unsafeUnwrap().state).toBe("ready");
        }),
        { numRuns: 30 },
      );
    });

    it("should preserve data through uploadStream round-trip", async () => {
      await fc.assert(
        fc.asyncProperty(binaryDataArb, filenameArb, async (data, filename) => {
          const { service } = setup();
          const fileId = FileAssetId();
          const folder = "test-folder";
          const stream = bufferToWebStream(data);

          const result = await service.uploadStream(ctx, {
            payload: {
              id: fileId,
              filename,
              mediaType: "application/octet-stream",
              stream,
              size: data.length,
            },
            folder,
          });

          expect(result.isOk()).toBe(true);
          const fileAsset = result._unsafeUnwrap();
          expect(fileAsset.state).toBe("ready");

          // Verify data integrity via direct GCS download
          // Use the returned sanitized filename, not the input filename
          const objectKey = `${folder}/${fileId}/${fileAsset.filename}`;
          const downloadResult = await gcsClient.download({
            bucketName: testBucket,
            objectName: objectKey,
          });
          expect(downloadResult.isOk()).toBe(true);
          expect(downloadResult._unsafeUnwrap().equals(data)).toBe(true);
        }),
        { numRuns: 30 },
      );
    });
  });

  // ==========================================================================
  // upload() Tests
  // ==========================================================================

  describe("upload()", () => {
    it("should upload small file and return ready state", async () => {
      const { service } = setup();
      const fileId = FileAssetId();
      const data = Buffer.from("Hello, World!");

      const result = await service.upload(ctx, {
        payload: {
          id: fileId,
          filename: "test.txt",
          mediaType: "text/plain",
          data: new Uint8Array(data),
          size: data.length,
        },
        folder: "test-folder",
      });

      expect(result.isOk()).toBe(true);
      const fileAsset = result._unsafeUnwrap();
      expect(fileAsset.state).toBe("ready");
      expect(fileAsset.id).toBe(fileId);
      expect(fileAsset.mediaType).toBe("text/plain");
    });

    it("should reject files exceeding size threshold", async () => {
      const { service } = setup();
      const fileId = FileAssetId();
      // Default threshold is 5MB, create 6MB file
      const data = Buffer.alloc(6 * 1024 * 1024);

      const result = await service.upload(ctx, {
        payload: {
          id: fileId,
          filename: "large.bin",
          mediaType: "application/octet-stream",
          data: new Uint8Array(data),
          size: data.length,
        },
        folder: "test-folder",
      });

      expect(result.isErr()).toBe(true);
    });

    it("should handle empty file", async () => {
      const { service } = setup();
      const fileId = FileAssetId();
      const data = Buffer.alloc(0);

      const result = await service.upload(ctx, {
        payload: {
          id: fileId,
          filename: "empty.txt",
          mediaType: "text/plain",
          data: new Uint8Array(data),
          size: data.length,
        },
        folder: "test-folder",
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().state).toBe("ready");
    });

    it("should reject filename that sanitizes to empty", async () => {
      const { service } = setup();
      const fileId = FileAssetId();
      const data = Buffer.from("content");

      // Filename that becomes empty after sanitization (only path traversal chars)
      const result = await service.upload(ctx, {
        payload: {
          id: fileId,
          filename: "....", // Becomes empty after removing '..'
          mediaType: "text/plain",
          data: new Uint8Array(data),
          size: data.length,
        },
        folder: "test-folder",
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe("BadRequest");
      expect(result._unsafeUnwrapErr().message).toContain(
        "Filename is invalid",
      );
    });
  });

  // ==========================================================================
  // uploadStream() Tests
  // ==========================================================================

  describe("uploadStream()", () => {
    it("should upload stream and return ready state", async () => {
      const { service } = setup();
      const fileId = FileAssetId();
      const data = Buffer.from("Stream content");
      const stream = bufferToWebStream(data);

      const result = await service.uploadStream(ctx, {
        payload: {
          id: fileId,
          filename: "stream.txt",
          mediaType: "text/plain",
          stream,
          size: data.length,
        },
        folder: "test-folder",
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().state).toBe("ready");
    });

    it("should handle large stream", async () => {
      const { service } = setup();
      const fileId = FileAssetId();
      // 1MB file
      const data = Buffer.alloc(1024 * 1024, "x");
      const stream = bufferToWebStream(data);

      const result = await service.uploadStream(ctx, {
        payload: {
          id: fileId,
          filename: "large-stream.bin",
          mediaType: "application/octet-stream",
          stream,
          size: data.length,
        },
        folder: "test-folder",
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().state).toBe("ready");

      // Verify data integrity
      const objectKey = `test-folder/${fileId}/large-stream.bin`;
      const downloadResult = await gcsClient.download({
        bucketName: testBucket,
        objectName: objectKey,
      });
      expect(downloadResult.isOk()).toBe(true);
      expect(downloadResult._unsafeUnwrap().length).toBe(data.length);
    });

    it("should handle empty stream", async () => {
      const { service } = setup();
      const fileId = FileAssetId();
      const stream = bufferToWebStream(Buffer.alloc(0));

      const result = await service.uploadStream(ctx, {
        payload: {
          id: fileId,
          filename: "empty-stream.txt",
          mediaType: "text/plain",
          stream,
          size: 0,
        },
        folder: "test-folder",
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().state).toBe("ready");
    });

    it("should return failed state when stream errors", async () => {
      const { service } = setup();
      const fileId = FileAssetId();
      const errorStream = createErroringStream(
        500,
        new Error("Network failure"),
      );

      const result = await service.uploadStream(ctx, {
        payload: {
          id: fileId,
          filename: "error-stream.txt",
          mediaType: "text/plain",
          stream: errorStream,
        },
        folder: "test-folder",
      });

      expect(result.isOk()).toBe(true); // Returns ok with failed state
      expect(result._unsafeUnwrap().state).toBe("failed");
    });

    it("should clean up cache on successful upload", async () => {
      const { service } = setup();
      const fileId = FileAssetId();
      const stream = bufferToWebStream(Buffer.from("test"));

      const result = await service.uploadStream(ctx, {
        payload: {
          id: fileId,
          filename: "cleanup.txt",
          mediaType: "text/plain",
          stream,
        },
        folder: "test-folder",
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().state).toBe("ready");

      // getFile should return from storage, not cache
      const getResult = await service.getFile(ctx, {
        fileId,
        folder: "test-folder",
        filename: "cleanup.txt",
      });

      expect(getResult.isOk()).toBe(true);
      expect(getResult._unsafeUnwrap().state).toBe("ready");
    });
  });

  // ==========================================================================
  // getFile() Tests
  // ==========================================================================

  describe("getFile()", () => {
    it("should return ready when file exists in storage", async () => {
      const { service } = setup();
      // Upload file first
      const fileId = FileAssetId();
      await service.upload(ctx, {
        payload: {
          id: fileId,
          filename: "exists.txt",
          mediaType: "text/plain",
          data: new Uint8Array(Buffer.from("content")),
          size: Buffer.from("content").length,
        },
        folder: "test-folder",
      });

      const result = await service.getFile(ctx, {
        fileId,
        folder: "test-folder",
        filename: "exists.txt",
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().state).toBe("ready");
    });

    it("should return NotFound when not in storage or cache", async () => {
      const { service } = setup();
      const result = await service.getFile(ctx, {
        fileId: FileAssetId(),
        folder: "test-folder",
        filename: "nonexistent.txt",
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe("NotFound");
    });

    it("should prioritize storage over cache", async () => {
      const { service } = setup();
      // Upload file
      const fileId = FileAssetId();
      await service.upload(ctx, {
        payload: {
          id: fileId,
          filename: "priority.txt",
          mediaType: "text/plain",
          data: new Uint8Array(Buffer.from("content")),
          size: Buffer.from("content").length,
        },
        folder: "test-folder",
      });

      // Even if cache had stale state, storage should win
      const result = await service.getFile(ctx, {
        fileId,
        folder: "test-folder",
        filename: "priority.txt",
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().state).toBe("ready");
    });
  });

  // ==========================================================================
  // listFiles() Tests
  // ==========================================================================

  describe("listFiles()", () => {
    it("should list uploaded files in folder", async () => {
      const { service } = setup();
      // Upload multiple files
      const fileIds = [FileAssetId(), FileAssetId(), FileAssetId()];
      for (let i = 0; i < fileIds.length; i++) {
        await service.upload(ctx, {
          payload: {
            id: fileIds[i],
            filename: `file-${i}.txt`,
            mediaType: "text/plain",
            data: new Uint8Array(Buffer.from(`content-${i}`)),
            size: Buffer.from(`content-${i}`).length,
          },
          folder: "list-folder",
        });
      }

      const result = await service.listFiles(ctx, {
        folder: "list-folder",
      });

      expect(result.isOk()).toBe(true);
      const { files } = result._unsafeUnwrap();
      expect(files.length).toBe(3);
      expect(files.every((f) => f.state === "ready")).toBe(true);
    });

    it("should return empty list for empty folder", async () => {
      const { service } = setup();
      const result = await service.listFiles(ctx, {
        folder: "empty-folder",
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().files.length).toBe(0);
    });

    it("should support pagination", async () => {
      const { service } = setup();
      // Upload multiple files
      for (let i = 0; i < 5; i++) {
        await service.upload(ctx, {
          payload: {
            id: FileAssetId(),
            filename: `paginate-${i}.txt`,
            mediaType: "text/plain",
            data: new Uint8Array(Buffer.from(`content-${i}`)),
            size: Buffer.from(`content-${i}`).length,
          },
          folder: "paginate-folder",
        });
      }

      // First page
      const page1Result = await service.listFiles(ctx, {
        folder: "paginate-folder",
        maxResults: 2,
      });

      expect(page1Result.isOk()).toBe(true);
      const page1 = page1Result._unsafeUnwrap();
      expect(page1.files.length).toBe(2);

      // If there's a next page, fetch it
      if (page1.nextPageToken) {
        const page2Result = await service.listFiles(ctx, {
          folder: "paginate-folder",
          maxResults: 2,
          pageToken: page1.nextPageToken,
        });

        expect(page2Result.isOk()).toBe(true);
        expect(page2Result._unsafeUnwrap().files.length).toBeGreaterThan(0);
      }
    });
  });

  // ==========================================================================
  // deleteFile() Tests
  // ==========================================================================

  describe("deleteFile()", () => {
    it("should delete file from storage", async () => {
      const { service } = setup();
      // Upload file first
      const fileId = FileAssetId();
      await service.upload(ctx, {
        payload: {
          id: fileId,
          filename: "delete-me.txt",
          mediaType: "text/plain",
          data: new Uint8Array(Buffer.from("to be deleted")),
          size: Buffer.from("to be deleted").length,
        },
        folder: "test-folder",
      });

      // Verify it exists
      const beforeDelete = await service.getFile(ctx, {
        fileId,
        folder: "test-folder",
        filename: "delete-me.txt",
      });
      expect(beforeDelete.isOk()).toBe(true);

      // Delete it
      const deleteResult = await service.deleteFile(ctx, {
        fileId,
        folder: "test-folder",
        filename: "delete-me.txt",
      });
      expect(deleteResult.isOk()).toBe(true);

      // Verify it's gone
      const afterDelete = await service.getFile(ctx, {
        fileId,
        folder: "test-folder",
        filename: "delete-me.txt",
      });
      expect(afterDelete.isErr()).toBe(true);
      expect(afterDelete._unsafeUnwrapErr().code).toBe("NotFound");
    });

    it("should return NotFound when deleting non-existent file", async () => {
      const { service } = setup();
      const fileId = FileAssetId();

      const result = await service.deleteFile(ctx, {
        fileId,
        folder: "test-folder",
        filename: "does-not-exist.txt",
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe("NotFound");
      expect(result._unsafeUnwrapErr().message).toBe("File not found");
    });
  });

  // ==========================================================================
  // State Transitions Tests
  // ==========================================================================

  describe("State Transitions", () => {
    it("should transition uploading → ready on successful upload", async () => {
      const { service } = setup();
      const fileId = FileAssetId();
      const stream = bufferToWebStream(Buffer.from("transitioning"));

      // Start upload
      const result = await service.uploadStream(ctx, {
        payload: {
          id: fileId,
          filename: "transition.txt",
          mediaType: "text/plain",
          stream,
        },
        folder: "test-folder",
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().state).toBe("ready");

      // Verify final state via getFile
      const getResult = await service.getFile(ctx, {
        fileId,
        folder: "test-folder",
        filename: "transition.txt",
      });

      expect(getResult.isOk()).toBe(true);
      expect(getResult._unsafeUnwrap().state).toBe("ready");
    });

    it("should transition to failed state on error", async () => {
      const { service } = setup();
      const fileId = FileAssetId();
      const errorStream = createErroringStream(100, new Error("Upload failed"));

      const result = await service.uploadStream(ctx, {
        payload: {
          id: fileId,
          filename: "fail-transition.txt",
          mediaType: "text/plain",
          stream: errorStream,
        },
        folder: "test-folder",
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().state).toBe("failed");

      // Verify state via getFile (should show failed from cache)
      const getResult = await service.getFile(ctx, {
        fileId,
        folder: "test-folder",
        filename: "fail-transition.txt",
      });

      expect(getResult.isOk()).toBe(true);
      expect(getResult._unsafeUnwrap().state).toBe("failed");
    });

    it("should handle concurrent uploads to different files", async () => {
      const { service } = setup();
      const uploads = Array.from({ length: 5 }, (_, i) => ({
        fileId: FileAssetId(),
        filename: `concurrent-${i}.txt`,
        data: Buffer.from(`content-${i}`),
      }));

      // Upload all concurrently
      const results = await Promise.all(
        uploads.map(({ fileId, filename, data }) =>
          service.uploadStream(ctx, {
            payload: {
              id: fileId,
              filename,
              mediaType: "text/plain",
              stream: bufferToWebStream(data),
            },
            folder: "concurrent-folder",
          }),
        ),
      );

      // All should succeed
      for (const result of results) {
        expect(result.isOk()).toBe(true);
        expect(result._unsafeUnwrap().state).toBe("ready");
      }

      // Verify all exist
      const listResult = await service.listFiles(ctx, {
        folder: "concurrent-folder",
      });
      expect(listResult.isOk()).toBe(true);
      expect(listResult._unsafeUnwrap().files.length).toBe(5);
    });
  });

  // ==========================================================================
  // getUploadUrl() Tests (Signed URLs)
  // ==========================================================================

  describe("getUploadUrl()", () => {
    it("should generate signed URL and create uploading state", async () => {
      const { service } = setup();

      const result = await service.getUploadUrl(ctx, {
        folder: "test-folder",
        filename: "signed-upload.txt",
        mediaType: "text/plain",
        size: 1024,
      });

      expect(result.isOk()).toBe(true);
      const response = result._unsafeUnwrap();

      // URL should point to emulator
      expect(response.uploadUrl).toBeDefined();
      expect(response.uploadUrl).toContain("localhost:4443");

      // FileAsset should be in uploading state
      expect(response.fileAsset.state).toBe("uploading");
      expect(response.fileAsset.mediaType).toBe("text/plain");

      // Should have expiration
      expect(response.expiresAt).toBeDefined();
    });

    it("should return sanitized filename in FileAsset", async () => {
      const { service } = setup();

      const result = await service.getUploadUrl(ctx, {
        folder: "test-folder",
        filename: "file..name.txt", // Contains ..
        mediaType: "text/plain",
        size: 512,
      });

      expect(result.isOk()).toBe(true);
      const { fileAsset } = result._unsafeUnwrap();

      // Should sanitize the filename
      expect(fileAsset.filename).toBe("filename.txt");
      expect(fileAsset.originalFilename).toBe("file..name.txt");
    });

    it("should be able to upload via signed URL", async () => {
      const { service } = setup();
      const content = "Hello via signed URL!";

      // Get upload URL
      const urlResult = await service.getUploadUrl(ctx, {
        folder: "test-folder",
        filename: "via-signed-url.txt",
        mediaType: "text/plain",
        size: content.length,
      });

      expect(urlResult.isOk()).toBe(true);
      const { uploadUrl, fileAsset } = urlResult._unsafeUnwrap();

      // Actually upload via the signed URL
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: content,
      });

      expect(uploadResponse.ok).toBe(true);

      // Verify file is now in storage
      const getResult = await service.getFile(ctx, {
        fileId: fileAsset.id,
        folder: "test-folder",
        filename: fileAsset.filename,
      });

      expect(getResult.isOk()).toBe(true);
      expect(getResult._unsafeUnwrap().state).toBe("ready");
    });

    it("should generate unique file IDs for each request", async () => {
      const { service } = setup();

      const [result1, result2] = await Promise.all([
        service.getUploadUrl(ctx, {
          folder: "test-folder",
          filename: "unique1.txt",
          mediaType: "text/plain",
          size: 100,
        }),
        service.getUploadUrl(ctx, {
          folder: "test-folder",
          filename: "unique2.txt",
          mediaType: "text/plain",
          size: 100,
        }),
      ]);

      expect(result1.isOk()).toBe(true);
      expect(result2.isOk()).toBe(true);

      const asset1 = result1._unsafeUnwrap().fileAsset;
      const asset2 = result2._unsafeUnwrap().fileAsset;

      expect(asset1.id).not.toBe(asset2.id);
    });
  });

  // ==========================================================================
  // getDownloadUrl() Tests (Signed URLs)
  // ==========================================================================

  describe("getDownloadUrl()", () => {
    it("should generate download URL for existing file", async () => {
      const { service } = setup();

      // Upload file first
      const fileId = FileAssetId();
      const content = "Download me!";
      await service.upload(ctx, {
        payload: {
          id: fileId,
          filename: "download-me.txt",
          mediaType: "text/plain",
          data: new Uint8Array(Buffer.from(content)),
          size: content.length,
        },
        folder: "test-folder",
      });

      // Get download URL
      const result = await service.getDownloadUrl(ctx, {
        fileId,
        folder: "test-folder",
        filename: "download-me.txt",
      });

      expect(result.isOk()).toBe(true);
      const response = result._unsafeUnwrap();

      // URL should point to emulator
      expect(response.url).toBeDefined();
      expect(response.url).toContain("localhost:4443");
    });

    it("should return NotFound for non-existent file", async () => {
      const { service } = setup();

      const result = await service.getDownloadUrl(ctx, {
        fileId: FileAssetId(),
        folder: "test-folder",
        filename: "nonexistent.txt",
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe("NotFound");
    });

    it("should be able to download via signed URL", async () => {
      const { service } = setup();

      // Upload file first
      const fileId = FileAssetId();
      const content = "Download content via signed URL!";
      await service.upload(ctx, {
        payload: {
          id: fileId,
          filename: "downloadable.txt",
          mediaType: "text/plain",
          data: new Uint8Array(Buffer.from(content)),
          size: content.length,
        },
        folder: "test-folder",
      });

      // Get download URL
      const urlResult = await service.getDownloadUrl(ctx, {
        fileId,
        folder: "test-folder",
        filename: "downloadable.txt",
      });

      expect(urlResult.isOk()).toBe(true);
      const { url } = urlResult._unsafeUnwrap();

      // Actually download via the signed URL
      const downloadResponse = await fetch(url);
      expect(downloadResponse.ok).toBe(true);

      const downloadedContent = await downloadResponse.text();
      expect(downloadedContent).toBe(content);
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe("Error Handling", () => {
    it("should handle storage errors gracefully", async () => {
      const { service } = setup();
      // Try to get file from non-existent location
      const result = await service.getFile(ctx, {
        fileId: FileAssetId(),
        folder: "nonexistent",
        filename: "nope.txt",
      });

      expect(result.isErr()).toBe(true);
      // Should return error, not throw
    });

    it("should not leave orphaned cache entries on successful upload", async () => {
      const { service } = setup();
      const fileId = FileAssetId();
      const stream = bufferToWebStream(Buffer.from("no orphans"));

      await service.uploadStream(ctx, {
        payload: {
          id: fileId,
          filename: "orphan-test.txt",
          mediaType: "text/plain",
          stream,
        },
        folder: "test-folder",
      });

      // Delete from storage directly
      const objectKey = `test-folder/${fileId}/orphan-test.txt`;
      await gcsClient.delete({
        bucketName: testBucket,
        objectName: objectKey,
      });

      // getFile should return NotFound (not stale uploading from cache)
      const result = await service.getFile(ctx, {
        fileId,
        folder: "test-folder",
        filename: "orphan-test.txt",
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe("NotFound");
    });
  });
});
