/**
 * Convert a Uint8Array buffer to a ReadableStream.
 * Used by upload() to delegate to uploadStream().
 */
export function bufferToStream(buffer: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(buffer);
      controller.close();
    },
  });
}
