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
import type { AppError } from '@core/errors/AppError';
import { unreachable } from '@core/unreachable';
import { ok, type Result } from 'neverthrow';
import {
  AGENT_CONTENT_FOLDER,
  AGENT_DOWNLOAD_URL_EXPIRY_SECONDS,
} from '../../constants';

export interface DeserializeMessagesDeps {
  readonly storageService: IStorageService;
  readonly logger: ILogger;
}

/**
 * Deserialize messages from state.
 * Refreshes signed URLs for images and files that were uploaded during serialization.
 * Never fails - on URL refresh failure, falls back to existing URL and logs warning.
 */
export async function deserializeMessages(
  ctx: Context,
  messages: Message[],
  deps: DeserializeMessagesDeps,
): Promise<Result<Message[], AppError>> {
  const deserialized: Message[] = [];

  for (const message of messages) {
    const result = await deserializeMessage(ctx, message, deps);
    deserialized.push(result);
  }

  return ok(deserialized);
}

async function deserializeMessage(
  ctx: Context,
  message: Message,
  deps: DeserializeMessagesDeps,
): Promise<Message> {
  switch (message.role) {
    case 'system':
    case 'tool':
      // No binary content in these message types
      return message;
    case 'user':
      return deserializeUserMessage(ctx, message, deps);
    case 'assistant':
      return deserializeAssistantMessage(ctx, message, deps);
    default:
      return unreachable(message);
  }
}

async function deserializeUserMessage(
  ctx: Context,
  message: UserMessage,
  deps: DeserializeMessagesDeps,
): Promise<UserMessage> {
  if (typeof message.content === 'string') {
    return message;
  }

  const deserializedParts: RequestUserContentPart[] = [];

  for (const part of message.content) {
    if (part.type === 'image') {
      const result = await deserializeImagePart(ctx, part, deps);
      deserializedParts.push(result);
    } else if (part.type === 'file') {
      const result = await deserializeFilePart(ctx, part, deps);
      deserializedParts.push(result);
    } else {
      deserializedParts.push(part);
    }
  }

  return { role: 'user', content: deserializedParts };
}

async function deserializeAssistantMessage(
  ctx: Context,
  message: AssistantMessage,
  deps: DeserializeMessagesDeps,
): Promise<AssistantMessage> {
  if (typeof message.content === 'string') {
    return message;
  }

  const deserializedParts: RequestAssistantContentPart[] = [];

  for (const part of message.content) {
    if (part.type === 'file') {
      const result = await deserializeFilePart(ctx, part, deps);
      deserializedParts.push(result);
    } else {
      deserializedParts.push(part);
    }
  }

  return { role: 'assistant', content: deserializedParts };
}

async function deserializeImagePart(
  ctx: Context,
  part: RequestImagePart,
  deps: DeserializeMessagesDeps,
): Promise<RequestImagePart> {
  // No storage tracking - pass through
  if (!part.storageFileId || !part.storageFilename) {
    return part;
  }

  // Image must be a string at this point (was serialized)
  if (typeof part.image !== 'string') {
    deps.logger.info('Unexpected binary image in serialized state', {
      storageFileId: part.storageFileId,
    });
    return part;
  }

  // Generate fresh signed URL
  const urlResult = await deps.storageService.getDownloadUrl(ctx, {
    fileId: part.storageFileId,
    folder: AGENT_CONTENT_FOLDER,
    filename: part.storageFilename,
    expiresInSeconds: AGENT_DOWNLOAD_URL_EXPIRY_SECONDS,
  });

  if (urlResult.isErr()) {
    deps.logger.info('Failed to generate fresh download URL, using existing', {
      fileId: part.storageFileId,
      error: urlResult.error.message,
    });
    return part;
  }

  return {
    type: 'image',
    image: urlResult.value.url,
    mediaType: part.mediaType,
    storageFileId: part.storageFileId,
    storageFilename: part.storageFilename,
  };
}

async function deserializeFilePart(
  ctx: Context,
  part: RequestFilePart,
  deps: DeserializeMessagesDeps,
): Promise<RequestFilePart> {
  // No storage tracking - pass through
  if (!part.storageFileId || !part.storageFilename) {
    return part;
  }

  // File data must be a string at this point (was serialized)
  if (typeof part.data !== 'string') {
    deps.logger.info('Unexpected binary file data in serialized state', {
      storageFileId: part.storageFileId,
    });
    return part;
  }

  // Generate fresh signed URL
  const urlResult = await deps.storageService.getDownloadUrl(ctx, {
    fileId: part.storageFileId,
    folder: AGENT_CONTENT_FOLDER,
    filename: part.storageFilename,
    expiresInSeconds: AGENT_DOWNLOAD_URL_EXPIRY_SECONDS,
  });

  if (urlResult.isErr()) {
    deps.logger.info('Failed to generate fresh download URL, using existing', {
      fileId: part.storageFileId,
      error: urlResult.error.message,
    });
    return part;
  }

  return {
    type: 'file',
    data: urlResult.value.url,
    mediaType: part.mediaType,
    filename: part.filename,
    storageFileId: part.storageFileId,
    storageFilename: part.storageFilename,
  };
}
