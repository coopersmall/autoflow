import { mock } from 'bun:test';
import type { RequestContext } from '@backend/infrastructure/http/handlers/domain/RequestContext';
import { CorrelationId } from '@core/domain/CorrelationId';

export function getMockedRequestContext(
  overrides: Partial<RequestContext> = {},
): RequestContext {
  return {
    correlationId: CorrelationId('test-correlation-id'),
    getParam: mock(),
    getSearchParam: mock(),
    getBody: mock(),
    getHeader: mock(),
    ...overrides,
  };
}
