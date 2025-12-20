import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';
import type { IVectorStoreClient } from '../domain/VectorStore';

/**
 * Deletes a document from the vector store.
 */
export async function deleteDocument(
  client: IVectorStoreClient,
  key: string,
): Promise<Result<void, AppError>> {
  return await client.del(key);
}
