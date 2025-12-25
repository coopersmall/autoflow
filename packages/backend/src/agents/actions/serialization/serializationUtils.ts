/**
 * Convert Uint8Array to ReadableStream for uploadStream.
 * Creates a simple stream that enqueues the buffer and closes immediately.
 */
export function bufferToStream(buffer: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(buffer);
      controller.close();
    },
  });
}

/**
 * Map MIME media types to file extensions.
 * Falls back to 'bin' for unknown types.
 */
export function getExtensionFromMediaType(
  mediaType: string | undefined,
): string {
  if (!mediaType) {
    return 'bin';
  }

  const mapping: Record<string, string> = {
    // Images
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    'image/x-icon': 'ico',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/avif': 'avif',
    // Documents
    'application/pdf': 'pdf',
    'application/json': 'json',
    'text/plain': 'txt',
    'text/html': 'html',
    'text/csv': 'csv',
    'text/markdown': 'md',
    'application/xml': 'xml',
    'text/xml': 'xml',
    // Archives
    'application/zip': 'zip',
    'application/x-tar': 'tar',
    'application/gzip': 'gz',
    // Office
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      'pptx',
    // Audio/Video
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'video/mp4': 'mp4',
    'video/mpeg': 'mpeg',
  };

  return mapping[mediaType] ?? 'bin';
}
