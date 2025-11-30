import {
  type HttpRequestError,
  type StreamChunk,
  type UserId,
  validate,
} from '@autoflow/core';
import { HttpClient } from '@client/http-client/httpClient';
import { err, ok, type Result } from 'neverthrow';
import { useMemo } from 'react';
import zod from 'zod';
import type { ParseStreamChunksOptions } from './client/parseStreamChunks.ts';
import { stream } from './client/stream.ts';

const DEFAULT_LOCAL_CLIENT_TIMEOUT = 30000; // Default timeout of 30 seconds for local client
const DEFAULT_STREAM_TIMEOUT = 300000; // Default stream timeout of 5 minutes

export function useLocalClient(): LocalClient {
  const client = new HttpClient(
    window.location.origin,
    DEFAULT_LOCAL_CLIENT_TIMEOUT,
    DEFAULT_STREAM_TIMEOUT,
    async (options) => {
      const headers = await getHeaders();
      return {
        ...options,
        headers: {
          ...options.headers,
          ...headers,
        },
        credentials: 'include',
      };
    },
  );
  return useMemo(() => new LocalClient(client), [client]);
}

export class LocalClient {
  constructor(
    private readonly client: HttpClient,
    private readonly actions = {
      stream,
    },
  ) {}

  async helloWorld(): Promise<Result<unknown, HttpRequestError>> {
    const result = await this.client.get({ uri: '/api/hello' });
    if (result.isErr()) {
      return err(result.error);
    }
    return ok(result.value);
  }

  async streamingCompletion(
    prompt: string,
    options?: ParseStreamChunksOptions,
  ): Promise<Result<AsyncIterable<StreamChunk>, HttpRequestError>> {
    return await this.actions.stream(
      this.client,
      '/api/streaming-completion',
      { prompt },
      {
        ...options,
        streamTimeoutMs: DEFAULT_STREAM_TIMEOUT,
      },
    );
  }

  async requestAuthCookie(
    userId: UserId,
  ): Promise<Result<{ claim: string }, HttpRequestError>> {
    const result = await this.client.post({
      uri: '/api/auth/request-cookie',
      body: { userId },
    });
    if (result.isErr()) {
      return err(result.error);
    }
    const schema = zod
      .object({
        claim: zod.string(),
      })
      .strict();
    const response = validate(schema, result.value);
    if (response.isErr()) {
      return err(response.error);
    }
    return ok({ claim: response.value.claim });
  }
}

async function getHeaders(): Promise<Record<string, string>> {
  const userAgent = window.navigator.userAgent;
  const language = window.navigator.language;
  const currentPage = window.location.href;
  const previousPage = document.referrer;

  let geolocation = '';
  try {
    const position = await new Promise<GeolocationPosition>(
      (resolve, reject) => {
        window.navigator.geolocation.getCurrentPosition(
          resolve,
          (error) => {
            reject(new Error(`Geolocation error: ${error.message}`));
          },
          { timeout: 2000, enableHighAccuracy: true },
        );
      },
    );
    geolocation = `${position.coords.latitude},${position.coords.longitude}`;
  } catch {
    geolocation = '';
  }

  return {
    'User-Agent': userAgent,
    Geolocation: geolocation,
    'Accept-Language': language,
    'Current-Page': currentPage,
    'Previous-Page': previousPage,
  };
}
