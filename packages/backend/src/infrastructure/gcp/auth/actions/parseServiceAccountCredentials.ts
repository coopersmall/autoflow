import type { AppError } from '@core/errors/AppError';
import { err, type Result } from 'neverthrow';

import { gcpCredentialsInvalid } from '../../errors/gcpErrors';
import {
  type GCPServiceAccountCredentials,
  validGCPServiceAccountCredentials,
} from '../domain/GCPServiceAccountCredentials';

/**
 * Parses a JSON string into validated GCP service account credentials.
 *
 * @param json - JSON string containing service account credentials
 * @returns Result containing validated credentials or error
 *
 * @example
 * ```typescript
 * const result = parseServiceAccountCredentials(appConfig.gcpCredentials);
 * if (result.isErr()) {
 *   logger.error('Invalid GCP credentials', result.error);
 *   return err(result.error);
 * }
 * const credentials = result.value;
 * ```
 */
export function parseServiceAccountCredentials(
  json: string,
): Result<GCPServiceAccountCredentials, AppError> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return err(
      gcpCredentialsInvalid('Invalid GCP credentials JSON', { cause: e }),
    );
  }
  return validGCPServiceAccountCredentials(parsed);
}
