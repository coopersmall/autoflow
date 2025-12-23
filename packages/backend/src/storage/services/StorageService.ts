/**
 * Storage service for file upload/download operations.
 *
 * Provides:
 * - Client-side uploads via signed URLs
 * - Application uploads with size-based routing (sync for small, async for large)
 * - State derivation from storage + cache
 */

import type {
  IAppConfigurationService,
  ILogger,
} from '@backend/infrastructure';
import type { Context } from '@backend/infrastructure/context';
import type { FileAsset, FileReferenceReady } from '@core/domain/file';
import { FileAssetId as createFileAssetId } from '@core/domain/file';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';
import { deleteFile } from '../actions/deleteFile';
import { getDownloadUrl } from '../actions/getDownloadUrl';
import { getFile } from '../actions/getFile';
import { getUploadUrl } from '../actions/getUploadUrl';
import { listFiles } from '../actions/listFiles';
import { upload } from '../actions/upload';
import { uploadStream } from '../actions/uploadStream';
import {
  createStorageProvider,
  type StorageProviderConfig,
} from '../adapters/createStorageProvider';
import type { IUploadStateCache } from '../cache/domain/UploadStateCache';
import { createUploadStateCache } from '../cache/UploadStateCache';
import type { IStorageProvider } from '../domain/StorageProvider';
import type { IStorageService } from '../domain/StorageService';
import type {
  DeleteFileRequest,
  GetDownloadUrlRequest,
  GetFileRequest,
  GetUploadUrlRequest,
  ListFilesRequest,
  ListFilesResponse,
  UploadRequest,
  UploadStreamRequest,
  UploadUrlResponse,
} from '../domain/StorageTypes';
import {
  DEFAULT_SIGNED_URL_EXPIRATION_SECONDS,
  DEFAULT_SMALL_FILE_SIZE_THRESHOLD,
  DEFAULT_UPLOAD_STATE_TTL_SECONDS,
} from '../domain/StorageTypes';

export function createStorageService(
  config: StorageServiceConfig,
): IStorageService {
  return Object.freeze(new StorageService(config));
}

/**
 * Configuration for creating a StorageService.
 */
export interface StorageServiceConfig {
  readonly logger: ILogger;
  readonly appConfig: IAppConfigurationService;
  readonly storageProviderConfig: StorageProviderConfig;

  /**
   * Signed URL expiration in seconds.
   * Default: 3600 (1 hour)
   */
  readonly signedUrlExpirationSeconds?: number;

  /**
   * How long to keep upload state in cache.
   * Failed states expire after this duration.
   * Default: 259200 (3 days)
   */
  readonly uploadStateTtlSeconds?: number;

  /**
   * Maximum file size for buffered upload.
   * Files larger than this must use uploadStream().
   * Default: 5242880 (5MB)
   */
  readonly smallFileSizeThreshold?: number;
}

interface StorageServiceActions {
  readonly getUploadUrl: typeof getUploadUrl;
  readonly upload: typeof upload;
  readonly uploadStream: typeof uploadStream;
  readonly getFile: typeof getFile;
  readonly getDownloadUrl: typeof getDownloadUrl;
  readonly listFiles: typeof listFiles;
  readonly deleteFile: typeof deleteFile;
}

interface StorageServiceDependencies {
  readonly createStorageProvider: typeof createStorageProvider;
  readonly createUploadStateCache: typeof createUploadStateCache;
}

class StorageService implements IStorageService {
  private readonly storageProvider: IStorageProvider;
  private readonly uploadStateCache: IUploadStateCache;
  private readonly signedUrlExpirationSeconds: number;
  private readonly uploadStateTtlSeconds: number;
  private readonly smallFileSizeThreshold: number;

  constructor(
    private readonly config: StorageServiceConfig,
    private readonly dependencies: StorageServiceDependencies = {
      createStorageProvider,
      createUploadStateCache,
    },
    private readonly actions: StorageServiceActions = {
      getUploadUrl,
      upload,
      uploadStream,
      getFile,
      getDownloadUrl,
      listFiles,
      deleteFile,
    },
  ) {
    this.storageProvider = this.dependencies.createStorageProvider(
      this.config.logger,
      this.config.storageProviderConfig,
    );
    this.uploadStateCache = this.dependencies.createUploadStateCache({
      logger: this.config.logger,
      appConfig: this.config.appConfig,
    });
    this.signedUrlExpirationSeconds =
      config.signedUrlExpirationSeconds ??
      DEFAULT_SIGNED_URL_EXPIRATION_SECONDS;
    this.uploadStateTtlSeconds =
      config.uploadStateTtlSeconds ?? DEFAULT_UPLOAD_STATE_TTL_SECONDS;
    this.smallFileSizeThreshold =
      config.smallFileSizeThreshold ?? DEFAULT_SMALL_FILE_SIZE_THRESHOLD;
  }

  async getUploadUrl(
    ctx: Context,
    request: GetUploadUrlRequest,
  ): Promise<Result<UploadUrlResponse, AppError>> {
    return this.actions.getUploadUrl(ctx, request, {
      storageProvider: this.storageProvider,
      uploadStateCache: this.uploadStateCache,
      logger: this.config.logger,
      signedUrlExpirationSeconds: this.signedUrlExpirationSeconds,
      uploadStateTtlSeconds: this.uploadStateTtlSeconds,
      newFileAssetId: createFileAssetId,
    });
  }

  async upload(
    ctx: Context,
    request: UploadRequest,
  ): Promise<Result<FileAsset, AppError>> {
    return this.actions.upload(ctx, request, {
      storageProvider: this.storageProvider,
      uploadStateCache: this.uploadStateCache,
      logger: this.config.logger,
      smallFileSizeThreshold: this.smallFileSizeThreshold,
      uploadStateTtlSeconds: this.uploadStateTtlSeconds,
    });
  }

  async uploadStream(
    ctx: Context,
    request: UploadStreamRequest,
  ): Promise<Result<FileAsset, AppError>> {
    return this.actions.uploadStream(ctx, request, {
      storageProvider: this.storageProvider,
      uploadStateCache: this.uploadStateCache,
      logger: this.config.logger,
      uploadStateTtlSeconds: this.uploadStateTtlSeconds,
    });
  }

  async getFile(
    ctx: Context,
    request: GetFileRequest,
  ): Promise<Result<FileAsset, AppError>> {
    return this.actions.getFile(ctx, request, {
      storageProvider: this.storageProvider,
      uploadStateCache: this.uploadStateCache,
    });
  }

  async getDownloadUrl(
    ctx: Context,
    request: GetDownloadUrlRequest,
  ): Promise<Result<FileReferenceReady, AppError>> {
    return this.actions.getDownloadUrl(ctx, request, {
      storageProvider: this.storageProvider,
      logger: this.config.logger,
      signedUrlExpirationSeconds: this.signedUrlExpirationSeconds,
    });
  }

  async listFiles(
    ctx: Context,
    request: ListFilesRequest,
  ): Promise<Result<ListFilesResponse, AppError>> {
    return this.actions.listFiles(ctx, request, {
      storageProvider: this.storageProvider,
    });
  }

  async deleteFile(
    ctx: Context,
    request: DeleteFileRequest,
  ): Promise<Result<void, AppError>> {
    return this.actions.deleteFile(ctx, request, {
      storageProvider: this.storageProvider,
      uploadStateCache: this.uploadStateCache,
      logger: this.config.logger,
    });
  }
}
