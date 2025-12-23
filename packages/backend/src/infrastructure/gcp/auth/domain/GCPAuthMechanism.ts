import type { AppError } from '@core/errors/AppError';
import { validationError } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';
import zod from 'zod';

import { gcpServiceAccountCredentialsSchema } from './GCPServiceAccountCredentials';

// ============================================================================
// Individual Mechanism Schemas
// ============================================================================

const serviceAccountMechanismSchema = zod.strictObject({
  type: zod.literal('service_account'),
  credentials: gcpServiceAccountCredentialsSchema,
});

const oauth2MechanismSchema = zod.strictObject({
  type: zod.literal('oauth2'),
  accessToken: zod.string().min(1).describe('OAuth2 access token (pre-scoped)'),
  refreshToken: zod
    .string()
    .min(1)
    .optional()
    .describe('OAuth2 refresh token for auto-refresh'),
  projectId: zod
    .string()
    .min(1)
    .describe('GCP project ID (required for OAuth2)'),
});

const adcMechanismSchema = zod.strictObject({
  type: zod.literal('adc'),
  projectId: zod
    .string()
    .min(1)
    .optional()
    .describe('GCP project ID (derived from environment if not provided)'),
});

// ============================================================================
// Discriminated Union Schema
// ============================================================================

/**
 * Zod discriminated union for GCP auth mechanisms.
 * Supports three authentication types:
 * - service_account: Explicit service account credentials
 * - oauth2: Customer OAuth2 tokens (pre-scoped)
 * - adc: Application Default Credentials for GCP-hosted environments
 */
export const gcpAuthMechanismSchema = zod.discriminatedUnion('type', [
  serviceAccountMechanismSchema,
  oauth2MechanismSchema,
  adcMechanismSchema,
]);

// ============================================================================
// Type Exports
// ============================================================================

/**
 * Union type for all GCP auth mechanisms.
 */
export type GCPAuthMechanism = Readonly<
  zod.infer<typeof gcpAuthMechanismSchema>
>;

/**
 * Service account auth mechanism type.
 */
export type ServiceAccountMechanism = Readonly<
  zod.infer<typeof serviceAccountMechanismSchema>
>;

/**
 * OAuth2 auth mechanism type.
 */
export type OAuth2Mechanism = Readonly<zod.infer<typeof oauth2MechanismSchema>>;

/**
 * Application Default Credentials auth mechanism type.
 */
export type ADCMechanism = Readonly<zod.infer<typeof adcMechanismSchema>>;

// ============================================================================
// Validation Function
// ============================================================================

/**
 * Validates unknown input as a GCP auth mechanism.
 *
 * @param input - Unknown value to validate
 * @returns Result containing validated auth mechanism or validation error
 *
 * @example
 * ```typescript
 * const result = validGCPAuthMechanism({ type: 'adc' });
 * if (result.isErr()) {
 *   return err(result.error);
 * }
 * const mechanism = result.value;
 * ```
 */
export function validGCPAuthMechanism(
  input: unknown,
): Result<GCPAuthMechanism, AppError> {
  const result = gcpAuthMechanismSchema.safeParse(input);
  if (!result.success) {
    return err(validationError(result.error));
  }
  return ok(result.data);
}
