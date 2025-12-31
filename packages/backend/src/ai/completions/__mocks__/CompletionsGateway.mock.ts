import { mock } from 'bun:test';
import type { ExtractMockMethods } from '@core/types';
import type { ICompletionsGateway } from '../domain/CompletionsGateway';

export function getMockedCompletionsGateway(): ExtractMockMethods<ICompletionsGateway> {
  return {
    completion: mock(),
    completionObject: mock(),
    streamCompletion: mock(),
    streamCompletionObject: mock(),
  };
}
