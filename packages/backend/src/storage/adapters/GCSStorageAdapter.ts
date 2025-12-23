/**
 * Adapter that wraps IStorageClient (GCP) to implement IStorageProvider.
 *
 * This adapter:
 * - Binds a specific bucket at construction time
 * - Translates between IStorageClient's request/response types and IStorageProvider's simpler interface
 * - Maps field names (objectName -> key, updated -> updatedAt, etc.)
 */

import { Readable } from 'node:stream';
import {
  createGCSClient,
  type GCPAuthMechanism,
  type ILogger,
} from '@backend/infrastructure';
import type { IStorageClient } from '@backend/infrastructure/gcp/storage/domain/StorageClient';
import type { AppError } from '@core/errors/AppError';
import { internalError } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';
import type {
  IStorageProvider,
  ListOptions,
  ListResult,
  ObjectMetadata,
  PutStreamOptions,
  SignedUploadUrlOptions,
} from '../domain/StorageProvider';

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a GCS storage adapter.
 *
 * @param client - The GCS storage client
 * @param bucketName - The bucket to use for all operations
 * @returns IStorageProvider implementation
 *
 * @example
 * ```typescript
 * const client = createGCSClient(mechanism, logger);
 * const provider = createGcsStorageAdapter(client, 'my-bucket');
 *
 * await provider.put('path/to/file.txt', buffer, { contentType: 'text/plain' });
 * ```
 */
export function createGCSStorageAdapter(
  auth: GCPAuthMechanism,
  logger: ILogger,
  bucketName: string,
): IStorageProvider {
  const client = createGCSClient(auth, logger);
  return Object.freeze(new GCSStorageAdapter(client, bucketName, logger));
}

// ─────────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────────

const _CHUNK_SIZE = 8 * 1024 * 1024; // 8MB chunks for resumable uploads

class GCSStorageAdapter implements IStorageProvider {
  constructor(
    private readonly client: IStorageClient,
    private readonly bucketName: string,
    private readonly logger: ILogger,
  ) {}

  async putStream(
    key: string,
    stream: ReadableStream<Uint8Array>,
    options: PutStreamOptions,
  ): Promise<Result<void, AppError>> {
    try {
      // Convert Web ReadableStream to Node.js Readable stream
      const nodeStream = this.webStreamToNodeStream(stream);

      // Use the client's uploadStream method which handles resumable uploads
      const result = await this.client.uploadStream({
        bucketName: this.bucketName,
        objectName: key,
        stream: nodeStream,
        contentType: options.contentType,
        metadata: options.metadata,
      });

      if (result.isErr()) {
        return err(result.error);
      }

      return ok(undefined);
    } catch (error) {
      this.logger.error('putStream failed', error, {
        bucketName: this.bucketName,
        key,
      });

      // Map the error to AppError
      return err(
        internalError('putStream failed', {
          cause: error,
          metadata: { bucketName: this.bucketName, key },
        }),
      );
    }
  }

  /**
   * Convert Web ReadableStream to Node.js Readable stream.
   * Required because GCS SDK expects Node.js streams.
   */
  private webStreamToNodeStream(
    webStream: ReadableStream<Uint8Array>,
  ): Readable {
    const reader = webStream.getReader();

    return new Readable({
      async read() {
        try {
          const { done, value } = await reader.read();
          if (done) {
            this.push(null);
          } else {
            this.push(Buffer.from(value));
          }
        } catch (error) {
          this.destroy(
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      },
    });
  }

  async exists(key: string): Promise<Result<boolean, AppError>> {
    return this.client.exists({
      bucketName: this.bucketName,
      objectName: key,
    });
  }

  async delete(key: string): Promise<Result<void, AppError>> {
    return this.client.delete({
      bucketName: this.bucketName,
      objectName: key,
    });
  }

  async getMetadata(
    key: string,
  ): Promise<Result<ObjectMetadata | null, AppError>> {
    const result = await this.client.getMetadata({
      bucketName: this.bucketName,
      objectName: key,
    });

    return result.map((metadata) => {
      if (metadata === null) {
        return null;
      }

      return {
        key: metadata.name,
        size: metadata.size,
        contentType: metadata.contentType,
        updatedAt: metadata.updated,
        metadata: metadata.metadata,
      };
    });
  }

  async getSignedUploadUrl(
    key: string,
    options: SignedUploadUrlOptions,
  ): Promise<Result<string, AppError>> {
    return this.client.getSignedUrl({
      bucketName: this.bucketName,
      objectName: key,
      action: 'write',
      expiresInSeconds: options.expiresInSeconds,
    });
  }

  async getSignedDownloadUrl(
    key: string,
    expiresInSeconds: number,
  ): Promise<Result<string, AppError>> {
    return this.client.getSignedUrl({
      bucketName: this.bucketName,
      objectName: key,
      action: 'read',
      expiresInSeconds,
    });
  }

  async list(
    prefix: string,
    options?: ListOptions,
  ): Promise<Result<ListResult, AppError>> {
    const result = await this.client.list({
      bucketName: this.bucketName,
      prefix,
      maxResults: options?.maxResults,
      pageToken: options?.cursor,
    });

    return result.map((response) => ({
      objects: response.files.map((file) => ({
        key: file.name,
        size: file.size,
        contentType: file.contentType,
        updatedAt: file.updated,
        metadata: undefined, // list doesn't return custom metadata
      })),
      nextCursor: response.nextPageToken,
    }));
  }
}
