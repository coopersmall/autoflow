/**
 * Utilities for building and sanitizing storage object keys.
 *
 * Object keys follow the format: `{folder}/{fileAssetId}/{filename}`
 *
 * This structure:
 * - Groups files by logical folder (e.g., `users/usr_123/documents`)
 * - Uses FileAssetId as a unique subdirectory to avoid naming collisions
 * - Preserves the sanitized filename for human readability
 *
 * @module storage/actions/buildObjectKey
 */

import type { FileAssetId } from '@core/domain/file';
import type { AppError } from '@core/errors/AppError';
import { badRequest } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';

/**
 * Builds the storage object key for a file.
 *
 * The key format is: `{folder}/{fileAssetId}/{sanitizedFilename}`
 *
 * @param folder - Caller-provided folder path (e.g., "users/usr_123/files")
 * @param fileId - Unique FileAssetId for the file
 * @param filename - Original filename (will be sanitized for safety)
 * @returns Full object key for storage operations
 *
 * @example
 * ```typescript
 * buildObjectKey('users/usr_123/docs', 'file_abc', 'report.pdf')
 * // Returns: 'users/usr_123/docs/file_abc/report.pdf'
 *
 * buildObjectKey('uploads/', 'file_xyz', '../secret.txt')
 * // Returns: 'uploads/file_xyz/secret.txt' (path traversal removed)
 * ```
 */
export function buildObjectKey(
  folder: string,
  fileId: FileAssetId,
  filename: string,
): string {
  const sanitized = sanitizeFilename(filename);
  const normalizedFolder = folder.replace(/\/+$/, ''); // Remove trailing slashes
  return `${normalizedFolder}/${fileId}/${sanitized}`;
}

/**
 * Validates and sanitizes a filename, returning an error if the result is empty.
 *
 * @param filename - Original filename to validate
 * @returns Result containing sanitized filename or validation error
 *
 * @example
 * validateAndSanitizeFilename('file.txt') // Ok('file.txt')
 * validateAndSanitizeFilename('..') // Err(BadRequest)
 * validateAndSanitizeFilename('  ') // Err(BadRequest)
 */
export function validateAndSanitizeFilename(
  filename: string,
): Result<string, AppError> {
  const sanitized = sanitizeFilename(filename);

  if (sanitized.length === 0) {
    return err(
      badRequest(
        'Filename is invalid. After removing unsafe characters, the filename is empty.',
        {
          metadata: {
            originalFilename: filename,
          },
        },
      ),
    );
  }

  return ok(sanitized);
}

/**
 * Sanitize filename to prevent path traversal and invalid characters.
 *
 * @param filename - Original filename
 * @returns Sanitized filename safe for storage
 *
 * @example
 * sanitizeFilename('file..txt') // 'filetxt'
 * sanitizeFilename('path/to/file.txt') // 'path_to_file.txt'
 * sanitizeFilename('file<name>.txt') // 'file_name_.txt'
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\.\./g, '') // Remove path traversal
    .replace(/[<>:"|?*]/g, '_') // Replace invalid chars
    .replace(/\//g, '_') // Replace forward slashes
    .replace(/\\/g, '_') // Replace backslashes
    .trim();
}
