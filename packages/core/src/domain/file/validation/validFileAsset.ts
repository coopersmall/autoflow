import type { AppError } from '@core/errors/AppError';
import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';
import type { FileAsset } from '../FileAsset';
import { fileAssetSchema } from '../FileAsset';
import type { FileAssetId } from '../FileAssetId';
import { fileAssetIdSchema } from '../FileAssetId';
import type { FilePayload } from '../FilePayload';
import { filePayloadSchema } from '../FilePayload';
import type { FileReference } from '../FileReference';
import { fileReferenceSchema } from '../FileReference';

export function validFileAssetId(
  input: unknown,
): Result<FileAssetId, AppError> {
  return validate(fileAssetIdSchema, input);
}

export function validFileAsset(input: unknown): Result<FileAsset, AppError> {
  return validate(fileAssetSchema, input);
}

export function validFilePayload(
  input: unknown,
): Result<FilePayload, AppError> {
  return validate(filePayloadSchema, input);
}

export function validFileReference(
  input: unknown,
): Result<FileReference, AppError> {
  return validate(fileReferenceSchema, input);
}
