import type { AppError } from '@core/errors/AppError';
import { validationError } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';
import zod from 'zod';

/**
 * Zod schema for GCP service account credentials.
 * Matches the structure of a Google Cloud service account JSON key file.
 */
export const gcpServiceAccountCredentialsSchema = zod.strictObject({
  type: zod.literal('service_account'),
  project_id: zod.string().min(1).describe('GCP project ID'),
  private_key_id: zod.string().min(1).describe('Private key ID'),
  private_key: zod.string().min(1).describe('Private key in PEM format'),
  client_email: zod.string().email().describe('Service account email'),
  client_id: zod.string().min(1).describe('Client ID'),
  auth_uri: zod.string().url().describe('Auth URI'),
  token_uri: zod.string().url().describe('Token URI'),
  auth_provider_x509_cert_url: zod
    .string()
    .url()
    .describe('Auth provider cert URL'),
  client_x509_cert_url: zod.string().url().describe('Client cert URL'),
});

/**
 * GCP service account credentials type.
 * Immutable type derived from the Zod schema.
 */
export type GCPServiceAccountCredentials = Readonly<
  zod.infer<typeof gcpServiceAccountCredentialsSchema>
>;

/**
 * Validates unknown input as GCP service account credentials.
 *
 * @param input - Unknown value to validate
 * @returns Result containing validated credentials or validation error
 *
 * @example
 * ```typescript
 * const result = validGCPServiceAccountCredentials(parsedJson);
 * if (result.isErr()) {
 *   return err(result.error);
 * }
 * const credentials = result.value;
 * ```
 */
export function validGCPServiceAccountCredentials(
  input: unknown,
): Result<GCPServiceAccountCredentials, AppError> {
  const result = gcpServiceAccountCredentialsSchema.safeParse(input);
  if (!result.success) {
    return err(validationError(result.error));
  }
  return ok(result.data);
}
