import type {
  AgentRunOptions,
  SerializationDeps,
} from '@backend/agents/domain';
import type { Context } from '@backend/infrastructure/context';
import type {
  AssistantMessage,
  Message,
  RequestAssistantContentPart,
  RequestFilePart,
  RequestImagePart,
  RequestUserContentPart,
  UserMessage,
} from '@core/domain/ai/request/completions';
import {
  type FileAssetId,
  FileAssetId as newFileAssetId,
} from '@core/domain/file';
import type { AppError } from '@core/errors/AppError';
import { internalError } from '@core/errors/factories';
import { unreachable } from '@core/unreachable';
import { err, ok, type Result } from 'neverthrow';
import {
  AGENT_CONTENT_FOLDER,
  AGENT_DOWNLOAD_URL_EXPIRY_SECONDS,
} from '../../domain';
import {
  bufferToStream,
  getExtensionFromMediaType,
} from './serializationUtils';

/**
 * Serialize messages for state persistence.
 * Uploads binary content (images and files with Uint8Array data) to storage and replaces with signed URLs.
 */
export async function serializeMessages(
  ctx: Context,
  messages: Message[],
  deps: SerializationDeps,
  options?: AgentRunOptions,
): Promise<Result<Message[], AppError>> {
  const serialized: Message[] = [];

  for (const message of messages) {
    const result = await serializeMessage(ctx, message, deps, options);
    if (result.isErr()) {
      return err(result.error);
    }
    serialized.push(result.value);
  }

  return ok(serialized);
}

async function serializeMessage(
  ctx: Context,
  message: Message,
  deps: SerializationDeps,
  options?: AgentRunOptions,
): Promise<Result<Message, AppError>> {
  switch (message.role) {
    case 'system':
    case 'tool':
      // No binary content in these message types
      return ok(message);
    case 'user':
      return serializeUserMessage(ctx, message, deps, options);
    case 'assistant':
      return serializeAssistantMessage(ctx, message, deps, options);
    default:
      return unreachable(message);
  }
}

async function serializeUserMessage(
  ctx: Context,
  message: UserMessage,
  deps: SerializationDeps,
  options?: AgentRunOptions,
): Promise<Result<UserMessage, AppError>> {
  if (typeof message.content === 'string') {
    return ok(message);
  }

  const serializedParts: RequestUserContentPart[] = [];

  for (const part of message.content) {
    if (part.type === 'image') {
      const result = await serializeImagePart(ctx, part, deps, options);
      if (result.isErr()) {
        return err(result.error);
      }
      serializedParts.push(result.value);
    } else if (part.type === 'file') {
      const result = await serializeFilePart(ctx, part, deps, options);
      if (result.isErr()) {
        return err(result.error);
      }
      serializedParts.push(result.value);
    } else {
      serializedParts.push(part);
    }
  }

  return ok({ role: 'user', content: serializedParts });
}

async function serializeAssistantMessage(
  ctx: Context,
  message: AssistantMessage,
  deps: SerializationDeps,
  options?: AgentRunOptions,
): Promise<Result<AssistantMessage, AppError>> {
  if (typeof message.content === 'string') {
    return ok(message);
  }

  const serializedParts: RequestAssistantContentPart[] = [];

  for (const part of message.content) {
    if (part.type === 'file') {
      const result = await serializeFilePart(ctx, part, deps, options);
      if (result.isErr()) {
        return err(result.error);
      }
      serializedParts.push(result.value);
    } else {
      serializedParts.push(part);
    }
  }

  return ok({ role: 'assistant', content: serializedParts });
}

/**
 * Parameters for uploading binary content to storage.
 */
interface UploadBinaryParams {
  readonly binary: Uint8Array;
  readonly mediaType: string;
  readonly contentType: 'image' | 'file';
  /** Optional filename override. If not provided, generates from fileId + extension. */
  readonly filenameOverride?: string;
}

/**
 * Result of a successful binary upload.
 */
interface UploadBinaryResult {
  readonly fileId: FileAssetId;
  readonly filename: string;
  readonly url: string;
}

/**
 * Uploads binary content to storage and returns a signed download URL.
 * Shared helper for both image and file serialization.
 */
async function uploadBinaryContent(
  ctx: Context,
  params: UploadBinaryParams,
  deps: SerializationDeps,
  options?: AgentRunOptions,
): Promise<Result<UploadBinaryResult, AppError>> {
  const { binary, mediaType, contentType, filenameOverride } = params;
  const fileId = newFileAssetId();
  const extension = getExtensionFromMediaType(mediaType);
  const filename = filenameOverride ?? `${fileId}.${extension}`;

  deps.logger.debug(`Uploading binary ${contentType} to storage`, {
    fileId,
    size: binary.byteLength,
    mediaType,
    filename,
  });

  // Upload binary content
  const uploadResult = await deps.storageService.uploadStream(ctx, {
    folder: options?.agentContentFolder ?? AGENT_CONTENT_FOLDER,
    payload: {
      id: fileId,
      filename,
      mediaType,
      stream: bufferToStream(binary),
      size: binary.byteLength,
    },
  });

  if (uploadResult.isErr()) {
    deps.logger.error(
      `Failed to upload binary ${contentType}`,
      uploadResult.error,
      {
        fileId,
      },
    );
    return err(uploadResult.error);
  }

  const fileAsset = uploadResult.value;

  // Check for failed upload (uploadStream returns Ok with failed state)
  if (fileAsset.state === 'failed') {
    return err(
      internalError(`Upload failed: ${fileAsset.error}`, {
        metadata: { fileId },
      }),
    );
  }

  // Get signed download URL (uploadStream doesn't return URL)
  const downloadUrlResult = await deps.storageService.getDownloadUrl(ctx, {
    fileId,
    folder: options?.agentContentFolder ?? AGENT_CONTENT_FOLDER,
    filename,
    expiresInSeconds:
      options?.agentDownloadUrlExpirySeconds ??
      AGENT_DOWNLOAD_URL_EXPIRY_SECONDS,
  });

  if (downloadUrlResult.isErr()) {
    deps.logger.error('Failed to get download URL', downloadUrlResult.error, {
      fileId,
    });
    return err(downloadUrlResult.error);
  }

  return ok({
    fileId,
    filename,
    url: downloadUrlResult.value.url,
  });
}

async function serializeImagePart(
  ctx: Context,
  part: RequestImagePart,
  deps: SerializationDeps,
  options?: AgentRunOptions,
): Promise<Result<RequestImagePart, AppError>> {
  // Already a string (URL or base64) - pass through
  if (typeof part.image === 'string') {
    return ok(part);
  }

  const mediaType = part.mediaType ?? 'application/octet-stream';

  const uploadResult = await uploadBinaryContent(
    ctx,
    {
      binary: part.image,
      mediaType,
      contentType: 'image',
    },
    deps,
    options,
  );

  if (uploadResult.isErr()) {
    return err(uploadResult.error);
  }

  return ok({
    type: 'image',
    image: uploadResult.value.url,
    mediaType: part.mediaType,
    storageFileId: uploadResult.value.fileId,
    storageFilename: uploadResult.value.filename,
  });
}

async function serializeFilePart(
  ctx: Context,
  part: RequestFilePart,
  deps: SerializationDeps,
  options?: AgentRunOptions,
): Promise<Result<RequestFilePart, AppError>> {
  // Already a string (URL or base64) - pass through
  if (typeof part.data === 'string') {
    return ok(part);
  }

  const uploadResult = await uploadBinaryContent(
    ctx,
    {
      binary: part.data,
      mediaType: part.mediaType,
      contentType: 'file',
      filenameOverride: part.filename,
    },
    deps,
    options,
  );

  if (uploadResult.isErr()) {
    return err(uploadResult.error);
  }

  return ok({
    type: 'file',
    data: uploadResult.value.url,
    mediaType: part.mediaType,
    filename: part.filename,
    storageFileId: uploadResult.value.fileId,
    storageFilename: uploadResult.value.filename,
  });
}
