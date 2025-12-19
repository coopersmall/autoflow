import { mock } from 'bun:test';
import { createContext } from '@backend/infrastructure/context';
import type { RequestContext } from '@backend/infrastructure/http/handlers/domain/RequestContext';
import { CorrelationId } from '@core/domain/CorrelationId';

export function getMockedRequestContext(
  overrides: Partial<Omit<RequestContext, 'signal' | 'ctx'>> & {
    ctx?: RequestContext['ctx'];
  } = {},
): RequestContext {
  const correlationId = CorrelationId('test-correlation-id');
  const controller = new AbortController();
  const ctx = overrides.ctx ?? createContext(correlationId, controller);

  return {
    ...overrides,
    ctx,
    getParam: overrides.getParam ?? mock(),
    getSearchParam: overrides.getSearchParam ?? mock(),
    getBody: overrides.getBody ?? mock(),
    getHeader: overrides.getHeader ?? mock(),
  };
}
