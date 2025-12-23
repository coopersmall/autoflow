import {
  type AppError,
  createAppError,
  type ErrorOptions,
} from "@core/errors/AppError";

// ============================================================================
// Auth Error Options
// ============================================================================

interface GCPAuthErrorOptions extends ErrorOptions {
  mechanism?: "service_account" | "oauth2" | "adc";
  projectId?: string;
}

// ============================================================================
// Auth Errors
// ============================================================================

/**
 * Authentication failed (invalid credentials, wrong project, etc.)
 */
export function gcpAuthFailed(
  message: string,
  options?: GCPAuthErrorOptions,
): AppError {
  return createAppError(message, "Unauthorized", {
    ...options,
    metadata: {
      ...options?.metadata,
      gcpService: "auth",
      mechanism: options?.mechanism,
      projectId: options?.projectId,
    },
  });
}

/**
 * Credentials are malformed or invalid
 */
export function gcpCredentialsInvalid(
  message: string,
  options?: ErrorOptions,
): AppError {
  return createAppError(message, "BadRequest", {
    ...options,
    metadata: {
      ...options?.metadata,
      gcpService: "auth",
      errorType: "invalid_credentials",
    },
  });
}

/**
 * Access token has expired (OAuth2 without refresh token)
 */
export function gcpTokenExpired(
  message: string,
  options?: GCPAuthErrorOptions,
): AppError {
  return createAppError(message, "Unauthorized", {
    ...options,
    metadata: {
      ...options?.metadata,
      gcpService: "auth",
      errorType: "token_expired",
      mechanism: options?.mechanism,
    },
  });
}

// ============================================================================
// Storage Error Options
// ============================================================================

interface GCSErrorOptions extends ErrorOptions {
  bucket?: string;
  objectName?: string;
  operation?:
    | "upload"
    | "download"
    | "delete"
    | "list"
    | "exists"
    | "getMetadata"
    | "signedUrl"
    | "bucketExists"
    | "createBucket";
}

// ============================================================================
// Storage Errors
// ============================================================================

/**
 * Generic storage operation failure
 */
export function gcsOperationFailed(
  message: string,
  options?: GCSErrorOptions,
): AppError {
  return createAppError(message, "InternalServer", {
    ...options,
    metadata: {
      ...options?.metadata,
      gcpService: "storage",
      bucket: options?.bucket,
      objectName: options?.objectName,
      operation: options?.operation,
    },
  });
}

/**
 * Object not found in bucket
 */
export function gcsObjectNotFound(
  message: string,
  options?: GCSErrorOptions,
): AppError {
  return createAppError(message, "NotFound", {
    ...options,
    metadata: {
      ...options?.metadata,
      gcpService: "storage",
      bucket: options?.bucket,
      objectName: options?.objectName,
    },
  });
}

/**
 * Bucket not found
 */
export function gcsBucketNotFound(
  message: string,
  options?: Omit<GCSErrorOptions, "objectName">,
): AppError {
  return createAppError(message, "NotFound", {
    ...options,
    metadata: {
      ...options?.metadata,
      gcpService: "storage",
      bucket: options?.bucket,
    },
  });
}

/**
 * Access denied to bucket or object
 */
export function gcsAccessDenied(
  message: string,
  options?: GCSErrorOptions,
): AppError {
  return createAppError(message, "Forbidden", {
    ...options,
    metadata: {
      ...options?.metadata,
      gcpService: "storage",
      bucket: options?.bucket,
      objectName: options?.objectName,
      operation: options?.operation,
    },
  });
}

/**
 * Storage quota exceeded
 */
export function gcsQuotaExceeded(
  message: string,
  options?: GCSErrorOptions,
): AppError {
  return createAppError(message, "TooManyRequests", {
    ...options,
    metadata: {
      ...options?.metadata,
      gcpService: "storage",
      bucket: options?.bucket,
    },
  });
}

/**
 * Bad request to GCS (malformed request, invalid parameters)
 */
export function gcsBadRequest(
  message: string,
  options?: GCSErrorOptions,
): AppError {
  return createAppError(message, "BadRequest", {
    ...options,
    metadata: {
      ...options?.metadata,
      gcpService: "storage",
      bucket: options?.bucket,
      objectName: options?.objectName,
      operation: options?.operation,
    },
  });
}

/**
 * Unauthorized access to GCS (authentication failure)
 */
export function gcsUnauthorized(
  message: string,
  options?: GCSErrorOptions,
): AppError {
  return createAppError(message, "Unauthorized", {
    ...options,
    metadata: {
      ...options?.metadata,
      gcpService: "storage",
      bucket: options?.bucket,
      objectName: options?.objectName,
      operation: options?.operation,
    },
  });
}

/**
 * Request timeout to GCS
 */
export function gcsTimeout(
  message: string,
  options?: GCSErrorOptions,
): AppError {
  return createAppError(message, "Timeout", {
    ...options,
    metadata: {
      ...options?.metadata,
      gcpService: "storage",
      bucket: options?.bucket,
      objectName: options?.objectName,
      operation: options?.operation,
    },
  });
}

/**
 * Gateway timeout from GCS (upstream timeout)
 */
export function gcsGatewayTimeout(
  message: string,
  options?: GCSErrorOptions,
): AppError {
  return createAppError(message, "GatewayTimeout", {
    ...options,
    metadata: {
      ...options?.metadata,
      gcpService: "storage",
      bucket: options?.bucket,
      objectName: options?.objectName,
      operation: options?.operation,
    },
  });
}

/**
 * Service unavailable from GCS (502, 503)
 */
export function gcsServiceUnavailable(
  message: string,
  options?: GCSErrorOptions,
): AppError {
  return createAppError(message, "InternalServer", {
    ...options,
    metadata: {
      ...options?.metadata,
      gcpService: "storage",
      bucket: options?.bucket,
      objectName: options?.objectName,
      operation: options?.operation,
      errorType: "service_unavailable",
    },
  });
}
