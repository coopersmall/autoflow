import type { FileAssetId } from '@core/domain/file';

/**
 * Builds the storage object key.
 * Format: {folder}/{fileAssetId}/{filename}
 *
 * @param folder - Caller-provided folder path (e.g., "users/usr_123/files")
 * @param fileId - FileAssetId
 * @param filename - Original filename (will be sanitized)
 * @returns Object key for storage
 */
export function buildObjectKey(
  folder: string,
  fileId: FileAssetId,
  filename: string,
): string {
  const sanitizedFilename = sanitizeFilename(filename);
  const normalizedFolder = folder.replace(/\/+$/, ''); // Remove trailing slashes
  return `${normalizedFolder}/${fileId}/${sanitizedFilename}`;
}

/**
 * Sanitize filename to prevent path traversal and invalid characters.
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\.\./g, '') // Remove path traversal
    .replace(/[<>:"|?*]/g, '_') // Replace invalid chars
    .replace(/\//g, '_') // Replace forward slashes
    .replace(/\\/g, '_') // Replace backslashes
    .trim();
}
