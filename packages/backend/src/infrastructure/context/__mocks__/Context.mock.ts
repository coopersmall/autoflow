import { mock } from 'bun:test';
import { CorrelationId } from '@core/domain/CorrelationId';
import type { Context } from '../Context';

/**
 * Creates a mock Context for testing.
 * Provides sensible defaults that can be overridden.
 */
export function createMockContext(overrides?: Partial<Context>): Context {
  return {
    correlationId: CorrelationId('test-correlation-id'),
    signal: new AbortController().signal,
    cancel: mock(),
    ...overrides,
  };
}
