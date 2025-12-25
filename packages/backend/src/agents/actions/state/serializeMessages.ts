import type { Context } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IStorageService } from '@backend/storage/domain/StorageService';
import type {
  AssistantMessage,
  Message,
  RequestAssistantContentPart,
  RequestFilePart,
  RequestImagePart,
  RequestUserContentPart,
  UserMessage,
} from '@core/domain/ai/request/completions';
import { FileAssetId } from '@core/domain/file';
import type { AppError } from '@core/errors/AppError';
import { internalError } from '@core/errors/factories';
import { unreachable } from '@core/unreachable';
import { err, ok, type Result } from 'neverthrow';
import {
  AGENT_CONTENT_FOLDER,
  AGENT_DOWNLOAD_URL_EXPIRY_SECONDS,
} from '../../constants';
import {
  bufferToStream,
  getExtensionFromMediaType,
} from './serializationUtils';

export interface SerializeMessagesDeps {
  readonly storageService: IStorageService;
  readonly logger: ILogger;
}

/**
 * Serialize messages for state persistence.
 * Uploads binary content (images and files with Uint8Array data) to storage and replaces with signed URLs.
 */
export async function serializeMessages(
  ctx: Context,
  messages: Message[],
  deps: SerializeMessagesDeps,
): Promise<Result<Message[], AppError>> {
  const serialized: Message[] = [];

  for (const message of messages) {
    const result = await serializeMessage(ctx, message, deps);
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
  deps: SerializeMessagesDeps,
): Promise<Result<Message, AppError>> {
  switch (message.role) {
    case 'system':
    case 'tool':
      // No binary content in these message types
      return ok(message);
    case 'user':
      return serializeUserMessage(ctx, message, deps);
    case 'assistant':
      return serializeAssistantMessage(ctx, message, deps);
    default:
      return unreachable(message);
  }
}

async function serializeUserMessage(
  ctx: Context,
  message: UserMessage,
  deps: SerializeMessagesDeps,
): Promise<Result<UserMessage, AppError>> {
  if (typeof message.content === 'string') {
    return ok(message);
  }

  const serializedParts: RequestUserContentPart[] = [];

  for (const part of message.content) {
    if (part.type === 'image') {
      const result = await serializeImagePart(ctx, part, deps);
      if (result.isErr()) {
        return err(result.error);
      }
      serializedParts.push(result.value);
    } else if (part.type === 'file') {
      const result = await serializeFilePart(ctx, part, deps);
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
  deps: SerializeMessagesDeps,
): Promise<Result<AssistantMessage, AppError>> {
  if (typeof message.content === 'string') {
    return ok(message);
  }

  const serializedParts: RequestAssistantContentPart[] = [];

  for (const part of message.content) {
    if (part.type === 'file') {
      const result = await serializeFilePart(ctx, part, deps);
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

async function serializeImagePart(
  ctx: Context,
  part: RequestImagePart,
  deps: SerializeMessagesDeps,
): Promise<Result<RequestImagePart, AppError>> {
  // Already a string (URL or base64) - pass through
  if (typeof part.image === 'string') {
    return ok(part);
  }

  // Binary content (Uint8Array) - upload to storage
  const binary = part.image;
  const fileId = FileAssetId();
  const extension = getExtensionFromMediaType(part.mediaType);
  const filename = `${fileId}.${extension}`;
  const mediaType = part.mediaType ?? 'application/octet-stream';

  deps.logger.debug('Uploading binary image to storage', {
    fileId,
    size: binary.byteLength,
    mediaType,
  });

  // Upload binary content
  const uploadResult = await deps.storageService.uploadStream(ctx, {
    folder: AGENT_CONTENT_FOLDER,
    payload: {
      id: fileId,
      filename,
      mediaType,
      stream: bufferToStream(binary),
      size: binary.byteLength,
    },
  });

  if (uploadResult.isErr()) {
    deps.logger.error('Failed to upload binary image', uploadResult.error, {
      fileId,
    });
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
    folder: AGENT_CONTENT_FOLDER,
    filename,
    expiresInSeconds: AGENT_DOWNLOAD_URL_EXPIRY_SECONDS,
  });

  if (downloadUrlResult.isErr()) {
    deps.logger.error('Failed to get download URL', downloadUrlResult.error, {
      fileId,
    });
    return err(downloadUrlResult.error);
  }

  return ok({
    type: 'image',
    image: downloadUrlResult.value.url,
    mediaType: part.mediaType,
    storageFileId: fileId,
    storageFilename: filename,
  });
}

async function serializeFilePart(
  ctx: Context,
  part: RequestFilePart,
  deps: SerializeMessagesDeps,
): Promise<Result<RequestFilePart, AppError>> {
  // Already a string (URL or base64) - pass through
  if (typeof part.data === 'string') {
    return ok(part);
  }

  // Binary content (Uint8Array) - upload to storage
  const binary = part.data;
  const fileId = FileAssetId();
  const extension = getExtensionFromMediaType(part.mediaType);
  const filename = part.filename ?? `${fileId}.${extension}`;

  deps.logger.debug('Uploading binary file to storage', {
    fileId,
    size: binary.byteLength,
    mediaType: part.mediaType,
    filename,
  });

  // Upload binary content
  const uploadResult = await deps.storageService.uploadStream(ctx, {
    folder: AGENT_CONTENT_FOLDER,
    payload: {
      id: fileId,
      filename,
      mediaType: part.mediaType,
      stream: bufferToStream(binary),
      size: binary.byteLength,
    },
  });

  if (uploadResult.isErr()) {
    deps.logger.error('Failed to upload binary file', uploadResult.error, {
      fileId,
    });
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
    folder: AGENT_CONTENT_FOLDER,
    filename,
    expiresInSeconds: AGENT_DOWNLOAD_URL_EXPIRY_SECONDS,
  });

  if (downloadUrlResult.isErr()) {
    deps.logger.error('Failed to get download URL', downloadUrlResult.error, {
      fileId,
    });
    return err(downloadUrlResult.error);
  }

  return ok({
    type: 'file',
    data: downloadUrlResult.value.url,
    mediaType: part.mediaType,
    filename: part.filename,
    storageFileId: fileId,
    storageFilename: filename,
  });
}
