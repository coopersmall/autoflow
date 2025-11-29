import { mock } from 'bun:test';
import type { IHttpServerClient } from '@backend/http/server/domain/HttpServerClient';
import type { ExtractMockMethods } from '@core/types';

export function getMockedHttpServerClient(): ExtractMockMethods<IHttpServerClient> {
  return {
    start: mock(() => mock(async () => {})),
  };
}
