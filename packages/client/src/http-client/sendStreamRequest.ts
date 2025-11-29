import {
  ErrorWithMetadata,
  getErrorFromString,
  type HttpRequestError,
} from '@autoflow/core';
import { err, ok, type Result } from 'neverthrow';
import type { StreamResponse } from './httpClient';

export async function sendStreamRequest(
  url: string,
  timeoutId: NodeJS.Timeout,
  options: RequestInit = {},
  controller: AbortController,
  beforeSend?: (options: RequestInit) => Promise<RequestInit>,
): Promise<Result<StreamResponse, HttpRequestError>> {
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
      new ErrorWithMetadata('Network request failed', 'InternalServer', {
        url,
        options: opts,
        cause: fetchError,
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
        new ErrorWithMetadata(
          `HTTP ${response.status}: ${response.statusText}`,
          'InternalServer',
          {
            status: response.status,
            statusText: response.statusText,
            url,
          },
        ),
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
        new ErrorWithMetadata('Authentication failed', 'Unauthorized', {
          status: response.status,
          url,
        }),
      );
    }
  }

  if (!response.body) {
    clearTimeout(timeoutId);
    controller.abort();
    return err(
      new ErrorWithMetadata('Response has no body stream', 'InternalServer', {
        url,
        contentType: response.headers.get('content-type'),
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
