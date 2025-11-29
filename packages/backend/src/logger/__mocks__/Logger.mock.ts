import { mock } from 'bun:test';
import type { ILogger } from '@backend/logger/Logger';
import type { ExtractMockMethods } from '@core/types';

export function getMockedLogger(): ExtractMockMethods<ILogger> {
  return {
    debug: mock(),
    info: mock(),
    error: mock(),
  };
}
