/**
 * Upload state tracked in cache for files currently being uploaded
 * or that have failed to upload.
 *
 * This is NOT stored for successfully uploaded files - storage is the
 * source of truth for 'ready' state.
 */
import { createIdSchema, newId } from '@core/domain/Id';
import { createItemSchema } from '@core/domain/Item';
import { validate } from '@core/validation/validate';
import zod from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// UploadStateId
// ─────────────────────────────────────────────────────────────────────────────

export type UploadStateId = zod.infer<typeof uploadStateIdSchema>;
export const UploadStateId = newId<UploadStateId>;
export const uploadStateIdSchema = createIdSchema('UploadStateId');

// ─────────────────────────────────────────────────────────────────────────────
// UploadState Schema
// ─────────────────────────────────────────────────────────────────────────────

const uploadStateItemSchema = createItemSchema(uploadStateIdSchema);

export const uploadStateSchema = uploadStateItemSchema.extend({
  folder: zod.string().min(1),
  /** Original filename provided by the caller */
  filename: zod.string().min(1),
  /** Sanitized filename used for storage (safe for object keys) */
  sanitizedFilename: zod.string().min(1),
  mediaType: zod.string().min(1),
  size: zod.number().int().positive().optional(),
  checksum: zod.string().optional(),
  state: zod.enum(['uploading', 'failed']),
  error: zod.string().optional(),
  updatedAt: zod.date().optional(),
});

export type UploadState = Readonly<zod.infer<typeof uploadStateSchema>>;

export const UPLOAD_STATE_SCHEMA_VERSION = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

export function validUploadState(input: unknown) {
  return validate(uploadStateSchema, input);
}
