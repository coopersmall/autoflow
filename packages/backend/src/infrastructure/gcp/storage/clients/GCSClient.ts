import type { Readable } from 'node:stream';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { AppError } from '@core/errors/AppError';
import { Storage } from '@google-cloud/storage';
import { get } from 'lodash';
import type { Result } from 'neverthrow';
import { createGCPAuthClient } from '../../auth/clients/GCPAuthClient';
import type { GCPAuthMechanism } from '../../auth/domain/GCPAuthMechanism';
import { bucketExists } from '../actions/bucketExists';
import { createBucket } from '../actions/createBucket';
import { deleteBucket } from '../actions/deleteBucket';
import { deleteObject } from '../actions/deleteObject';
import { downloadObject } from '../actions/downloadObject';
import { downloadObjectStream } from '../actions/downloadObjectStream';
import { getObjectMetadata } from '../actions/getObjectMetadata';
import { getSignedUrl } from '../actions/getSignedUrl';
import { listObjects } from '../actions/listObjects';
import { objectExists } from '../actions/objectExists';
import { uploadObject } from '../actions/uploadObject';
import { uploadObjectStream } from '../actions/uploadObjectStream';
import type { IStorageClient } from '../domain/StorageClient';
import type {
  CreateBucketRequest,
  DeleteRequest,
  DownloadRequest,
  DownloadStreamRequest,
  GetMetadataRequest,
  GetMetadataResponse,
  ListRequest,
  ListResponse,
  SignedUrlRequest,
  UploadRequest,
  UploadResponse,
  UploadStreamRequest,
} from '../domain/StorageTypes';

// ============================================================================
// Constants
// ============================================================================

const GCS_SCOPES = ['https://www.googleapis.com/auth/devstorage.read_write'];

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a GCS storage client.
 *
 * @param mechanism - The auth mechanism to use
 * @param logger - Logger instance
 * @returns IStorageClient instance (frozen)
 *
 * @example
 * ```typescript
 * const storageClient = createGCSClient(
 *   { type: 'service_account', credentials },
 *   logger,
 * );
 *
 * const result = await storageClient.upload({
 *   bucketName: 'my-bucket',
 *   objectName: 'file.txt',
 *   data: Buffer.from('hello'),
 * });
 * ```
 */
export function createGCSClient(
  mechanism: GCPAuthMechanism,
  logger: ILogger,
): IStorageClient {
  return Object.freeze(new GCSClient(mechanism, logger));
}

interface StorageCredentials {
  readonly client_email: string;
  readonly private_key: string;
}

function createStorageInstance(
  projectId: string,
  apiEndpoint?: string,
  credentials?: StorageCredentials,
): Storage {
  return new Storage({ projectId, apiEndpoint, credentials });
}

// ============================================================================
// Dependencies Interface
// ============================================================================

interface GCSClientDependencies {
  readonly createAuthClient: typeof createGCPAuthClient;
  readonly createStorageInstance: typeof createStorageInstance;
}

interface GCSClientActions {
  readonly uploadObject: typeof uploadObject;
  readonly uploadObjectStream: typeof uploadObjectStream;
  readonly downloadObject: typeof downloadObject;
  readonly downloadObjectStream: typeof downloadObjectStream;
  readonly deleteObject: typeof deleteObject;
  readonly objectExists: typeof objectExists;
  readonly getObjectMetadata: typeof getObjectMetadata;
  readonly listObjects: typeof listObjects;
  readonly getSignedUrl: typeof getSignedUrl;
  readonly bucketExists: typeof bucketExists;
  readonly createBucket: typeof createBucket;
  readonly deleteBucket: typeof deleteBucket;
}

const defaultDependencies: GCSClientDependencies = {
  createAuthClient: createGCPAuthClient,
  createStorageInstance,
};

const defaultActions: GCSClientActions = {
  uploadObject,
  uploadObjectStream,
  downloadObject,
  downloadObjectStream,
  deleteObject,
  objectExists,
  getObjectMetadata,
  listObjects,
  getSignedUrl,
  bucketExists,
  createBucket,
  deleteBucket,
};

// ============================================================================
// Implementation
// ============================================================================

class GCSClient implements IStorageClient {
  readonly projectId: string;
  private readonly storage: Storage;
  private readonly logger: ILogger;

  constructor(
    mechanism: GCPAuthMechanism,
    logger: ILogger,
    dependencies: GCSClientDependencies = defaultDependencies,
    private readonly actions: GCSClientActions = defaultActions,
  ) {
    const authClient = dependencies.createAuthClient(
      mechanism,
      GCS_SCOPES,
      logger,
    );

    // Extract credentials for signed URL support (only service_account has private_key)
    const credentials: StorageCredentials | undefined =
      mechanism.type === 'service_account'
        ? {
            client_email: mechanism.credentials.client_email,
            private_key: mechanism.credentials.private_key,
          }
        : undefined;

    this.projectId = authClient.projectId;
    this.storage = dependencies.createStorageInstance(
      this.projectId,
      get(mechanism, 'apiEndpoint'),
      credentials,
    );
    this.logger = logger;
  }

  async upload(
    request: UploadRequest,
  ): Promise<Result<UploadResponse, AppError>> {
    return this.actions.uploadObject(request, this.storage, this.logger);
  }

  async uploadStream(
    request: UploadStreamRequest,
  ): Promise<Result<UploadResponse, AppError>> {
    return this.actions.uploadObjectStream(request, this.storage, this.logger);
  }

  async download(request: DownloadRequest): Promise<Result<Buffer, AppError>> {
    return this.actions.downloadObject(request, this.storage, this.logger);
  }

  async downloadStream(
    request: DownloadStreamRequest,
  ): Promise<Result<Readable, AppError>> {
    return this.actions.downloadObjectStream(
      request,
      this.storage,
      this.logger,
    );
  }

  async delete(request: DeleteRequest): Promise<Result<void, AppError>> {
    return this.actions.deleteObject(request, this.storage, this.logger);
  }

  async exists(request: DownloadRequest): Promise<Result<boolean, AppError>> {
    return this.actions.objectExists(request, this.storage, this.logger);
  }

  async getMetadata(
    request: GetMetadataRequest,
  ): Promise<Result<GetMetadataResponse | null, AppError>> {
    return this.actions.getObjectMetadata(request, this.storage, this.logger);
  }

  async list(request: ListRequest): Promise<Result<ListResponse, AppError>> {
    return this.actions.listObjects(request, this.storage, this.logger);
  }

  async getSignedUrl(
    request: SignedUrlRequest,
  ): Promise<Result<string, AppError>> {
    return this.actions.getSignedUrl(request, this.storage, this.logger);
  }

  async bucketExists(bucketName: string): Promise<Result<boolean, AppError>> {
    return this.actions.bucketExists(bucketName, this.storage, this.logger);
  }

  async createBucket(
    request: CreateBucketRequest,
  ): Promise<Result<void, AppError>> {
    return this.actions.createBucket(request, this.storage, this.logger);
  }

  async deleteBucket(bucketName: string): Promise<Result<void, AppError>> {
    return this.actions.deleteBucket(bucketName, this.storage, this.logger);
  }
}
