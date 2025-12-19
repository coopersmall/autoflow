import type { AppError } from '@autoflow/core';
import { internalError } from '@autoflow/core';
import { err, ok, type Result } from 'neverthrow';
import { sendRequest } from './sendRequest.ts';
import { sendStreamRequest } from './sendStreamRequest.ts';

interface RequestOpts {
  credentials?: RequestCredentials;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

interface StreamRequestOpts extends RequestOpts {
  streamTimeoutMs?: number; // Separate timeout for streams
  retryAttempts?: number;
  retryDelayMs?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export interface StreamResponse {
  stream: ReadableStream<Uint8Array>;
  response: Response;
  cancel: () => void;
}

export class HttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number = 30000, // Default timeout of 30 seconds
    private readonly streamTimeoutMs: number = 300000, // Default stream timeout of 5 minutes
    private readonly beforeSend?: (
      options: RequestInit,
    ) => Promise<RequestInit>,
    private readonly actions = {
      sendRequest,
      sendStreamRequest,
    },
  ) {}

  // Existing methods...
  async get(
    {
      uri,
    }: {
      uri: string;
    },
    opts?: RequestOpts,
  ): Promise<Result<unknown, AppError>> {
    const { timeoutMs } = opts || {};
    const { config, timeoutId } = this.makeConfig(
      { uri, method: 'GET' },
      { timeoutMs, options: { ...opts } },
    );
    const urlResult = getUrl(this.baseUrl, uri);
    if (urlResult.isErr()) {
      return err(urlResult.error);
    }
    return this.actions.sendRequest(
      urlResult.value,
      timeoutId,
      config,
      this.beforeSend,
    );
  }

  async post(
    {
      uri,
      body,
    }: {
      uri: string;
      body: unknown;
    },
    opts: RequestOpts = {},
  ): Promise<Result<unknown, AppError>> {
    const { timeoutMs } = opts;
    const { config, timeoutId } = this.makeConfig(
      { uri, method: 'POST' },
      { timeoutMs, options: { ...opts, body: getBody(body) } },
    );
    const urlResult = getUrl(this.baseUrl, uri);
    if (urlResult.isErr()) {
      return err(urlResult.error);
    }
    return this.actions.sendRequest(
      urlResult.value,
      timeoutId,
      config,
      this.beforeSend,
    );
  }

  // New streaming methods
  async postStream(
    {
      uri,
      body,
    }: {
      uri: string;
      body: unknown;
    },
    opts: StreamRequestOpts = {},
  ): Promise<Result<StreamResponse, AppError>> {
    return this.streamRequest('POST', { uri, body }, opts);
  }

  async getStream(
    {
      uri,
    }: {
      uri: string;
    },
    opts: StreamRequestOpts = {},
  ): Promise<Result<StreamResponse, AppError>> {
    return this.streamRequest('GET', { uri }, opts);
  }

  private async streamRequest(
    method: 'GET' | 'POST',
    params: { uri: string; body?: unknown },
    opts: StreamRequestOpts = {},
  ): Promise<Result<StreamResponse, AppError>> {
    const {
      streamTimeoutMs = this.streamTimeoutMs,
      retryAttempts = 3,
      retryDelayMs = 1000,
      onRetry,
      ...requestOpts
    } = opts;

    const urlResult = getUrl(this.baseUrl, params.uri);
    if (urlResult.isErr()) {
      return err(urlResult.error);
    }

    for (let attempt = 0; attempt <= retryAttempts; attempt++) {
      const { config, timeoutId, controller } = this.makeStreamConfig(
        { method },
        {
          timeoutMs: streamTimeoutMs,
          options: {
            ...requestOpts,
            body: params.body ? getBody(params.body) : undefined,
          },
        },
      );

      const result = await this.actions.sendStreamRequest(
        urlResult.value,
        timeoutId,
        config,
        controller,
        this.beforeSend,
      );

      if (result.isOk()) {
        return ok(result.value);
      }

      // Retry logic
      if (attempt < retryAttempts) {
        if (onRetry) {
          onRetry(attempt + 1, result.error);
        }
        await this.delay(retryDelayMs * (attempt + 1)); // Exponential backoff
      }
    }

    // If all retries failed, return the last error
    const { config, timeoutId, controller } = this.makeStreamConfig(
      { method },
      { timeoutMs: streamTimeoutMs, options: { ...requestOpts } },
    );

    return this.actions.sendStreamRequest(
      urlResult.value,
      timeoutId,
      config,
      controller,
      this.beforeSend,
    );
  }

  makeConfig(
    {
      uri,
      method,
    }: {
      uri: string;
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    },
    opts: {
      timeoutMs?: number;
      options?: RequestInit;
    } = {},
  ): {
    config: RequestInit;
    timeoutId: NodeJS.Timeout;
  } {
    const { timeoutMs = this.timeoutMs, options = {} } = opts;

    const cache = options.cache || 'no-cache';
    const body = options.body || undefined;
    const credentials = options.credentials || 'omit';
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    };

    const controller = new AbortController();
    const { signal } = controller;
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs || this.timeoutMs);

    const config: RequestInit = {
      ...options,
      method,
      credentials,
      headers,
      cache,
      body,
      signal,
    };

    return { config, timeoutId };
  }

  private makeStreamConfig(
    {
      method,
    }: {
      method: 'GET' | 'POST';
    },
    opts: {
      timeoutMs?: number;
      options?: RequestInit;
    } = {},
  ): {
    config: RequestInit;
    timeoutId: NodeJS.Timeout;
    controller: AbortController;
  } {
    const { timeoutMs = this.streamTimeoutMs, options = {} } = opts;

    const cache = options.cache || 'no-cache';
    const body = options.body || undefined;
    const credentials = options.credentials || 'include';

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'text/plain, text/event-stream, application/json',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      ...options.headers,
    };

    const controller = new AbortController();
    const { signal } = controller;

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    const config: RequestInit = {
      ...options,
      method,
      credentials,
      headers,
      cache,
      body,
      signal,
    };

    return { config, timeoutId, controller };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

function getBody(body: unknown): string {
  if (typeof body === 'string') {
    return body;
  }
  return JSON.stringify(body);
}

function getUrl(baseUrl: string, uri: string): Result<string, AppError> {
  try {
    return ok(new URL(uri, baseUrl).toString());
  } catch (error) {
    return err(
      internalError('Invalid URL', {
        metadata: { baseUrl, uri },
        cause: error,
      }),
    );
  }
}
