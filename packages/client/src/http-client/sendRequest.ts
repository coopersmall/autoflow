import {
  type AppError,
  getErrorFromString,
  internalError,
} from '@autoflow/core';
import { err, ok, type Result } from 'neverthrow';

export async function sendRequest(
  url: string,
  timeoutId: NodeJS.Timeout,
  options: RequestInit = {},
  beforeSend?: (options: RequestInit) => Promise<RequestInit>,
): Promise<Result<unknown, AppError>> {
  let response: Response;
  let opts = options;
  if (beforeSend) {
    opts = await beforeSend(options);
  }
  try {
    response = await fetch(url, opts);
  } catch (error) {
    clearTimeout(timeoutId);
    const message = error instanceof Error ? error.message : 'Network error';
    return err(getErrorFromString(message));
  }

  if (!response.ok) {
    clearTimeout(timeoutId);
    const error = await response.text();
    return err(getErrorFromString(error));
  }

  if (response.status === 401 || response.status === 403) {
    clearTimeout(timeoutId);
    const error = await response.text();
    return err(getErrorFromString(error));
  }

  try {
    const data = await response.json();
    clearTimeout(timeoutId);
    return ok(data);
  } catch (error) {
    clearTimeout(timeoutId);
    return err(
      internalError('Failed to parse response JSON', {
        cause: error,
        metadata: { url, options },
      }),
    );
  }
}
