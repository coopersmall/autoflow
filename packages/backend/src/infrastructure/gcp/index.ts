// ============================================================================
// Auth Module
// ============================================================================

// Domain Types
export type {
  ADCMechanism,
  GCPAccessToken,
  GCPAuthMechanism,
  GCPServiceAccountCredentials,
  IGCPAuthClient,
  OAuth2Mechanism,
  ServiceAccountMechanism,
  TokenFetcher,
  TokenFetcherResult,
} from './auth';
// Actions
// Clients
// Validation
export {
  createADCTokenFetcher,
  createGCPAuthClient,
  createOAuth2TokenFetcher,
  createServiceAccountTokenFetcher,
  createTokenFetcher,
  gcpAccessTokenSchema,
  gcpAuthMechanismSchema,
  gcpServiceAccountCredentialsSchema,
  parseServiceAccountCredentials,
  validGCPAuthMechanism,
  validGCPServiceAccountCredentials,
} from './auth';

// ============================================================================
// Storage Module
// ============================================================================

// Domain Types
export type {
  CreateBucketRequest,
  DeleteRequest,
  DownloadRequest,
  DownloadStreamRequest,
  ExistsRequest,
  IStorageClient,
  ListRequest,
  ListResponse,
  SignedUrlAction,
  SignedUrlRequest,
  StorageFileInfo,
  StorageRequestBase,
  UploadRequest,
  UploadResponse,
  UploadStreamRequest,
} from './storage';
// Actions
// Clients
// Validation
export {
  bucketExists,
  createBucket,
  createBucketRequestSchema,
  createGCSClient,
  deleteObject,
  deleteRequestSchema,
  downloadObject,
  downloadObjectStream,
  downloadRequestSchema,
  existsRequestSchema,
  getSignedUrl,
  listObjects,
  listRequestSchema,
  listResponseSchema,
  objectExists,
  signedUrlActionSchema,
  signedUrlRequestSchema,
  storageFileInfoSchema,
  storageRequestBaseSchema,
  uploadObject,
  uploadObjectStream,
  uploadRequestSchema,
  uploadResponseSchema,
} from './storage';

// ============================================================================
// Errors
// ============================================================================

export {
  gcpAuthFailed,
  gcpCredentialsInvalid,
  gcpTokenExpired,
  gcsAccessDenied,
  gcsBucketNotFound,
  gcsObjectNotFound,
  gcsOperationFailed,
  gcsQuotaExceeded,
} from './errors/gcpErrors';
