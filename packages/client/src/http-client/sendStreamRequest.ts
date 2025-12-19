import {
  type AppError,
  getErrorFromString,
  internalError,
  unauthorized,
} from '@autoflow/core';
import { err, ok, type Result } from 'neverthrow';
import type { StreamResponse } from './httpClient.ts';

export async function sendStreamRequest(
  url: string,
  timeoutId: NodeJS.Timeout,
  options: RequestInit = {},
  controller: AbortController,
  beforeSend?: (options: RequestInit) => Promise<RequestInit>,
): Promise<Result<StreamResponse, AppError>> {
  let response: Response;
  let opts = options;

  if (beforeSend) {
    opts = await beforeSend(options);
  }

  try {
    response = await fetch(url, opts);
  } catch (fetchError) {
    clearTimeout(timeoutId);
    controller.abort();
    return err(
      internalError('Network request failed', {
        metadata: {
          url,
          options: opts,
          cause: fetchError,
        },
      }),
    );
  }

  if (!response.ok) {
    clearTimeout(timeoutId);
    controller.abort();

    try {
      const errorText = await response.text();
      return err(getErrorFromString(errorText));
    } catch {
      return err(
        internalError(`HTTP ${response.status}: ${response.statusText}`, {
          metadata: {
            status: response.status,
            statusText: response.statusText,
            url,
          },
        }),
      );
    }
  }

  if (response.status === 401 || response.status === 403) {
    clearTimeout(timeoutId);
    controller.abort();

    try {
      const errorText = await response.text();
      return err(getErrorFromString(errorText));
    } catch {
      return err(
        unauthorized('Authentication failed', {
          metadata: {
            status: response.status,
            url,
          },
        }),
      );
    }
  }

  if (!response.body) {
    clearTimeout(timeoutId);
    controller.abort();
    return err(
      internalError('Response has no body stream', {
        metadata: {
          url,
          contentType: response.headers.get('content-type'),
        },
      }),
    );
  }

  const cancel = () => {
    clearTimeout(timeoutId);
    controller.abort();
  };

  return ok({
    stream: response.body,
    response,
    cancel,
  });
}
