/**
 * Serializes a number array to a Buffer for Redis VECTOR field storage.
 * Uses Float32Array for compatibility with Redis FLOAT32 vector type.
 */
export function serializeVector(embedding: number[]): Buffer {
  const float32Array = new Float32Array(embedding);
  return Buffer.from(float32Array.buffer);
}

/**
 * Deserializes a Buffer back to a number array.
 * Used when reading vectors from Redis.
 */
export function deserializeVector(buffer: Buffer): number[] {
  const float32Array = new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / Float32Array.BYTES_PER_ELEMENT,
  );
  return Array.from(float32Array);
}
