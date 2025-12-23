import { createHash } from 'node:crypto';

/**
 * Calculate SHA-256 checksum of file data.
 *
 * @param data - File data as Uint8Array or Buffer
 * @returns Hex-encoded SHA-256 hash
 */
export function calculateChecksum(data: Uint8Array | Buffer): string {
  const hash = createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}
