import { createContext } from '@backend/infrastructure/context';
import type { Request } from '@backend/infrastructure/http/handlers/domain/Request';
import { CorrelationId } from '@core/domain/CorrelationId';

export function getMockRequest(overrides: Partial<Request> = {}): Request {
  const controller = new AbortController();
  const defaultCtx = createContext(
    CorrelationId('mock-request-id'),
    controller,
  );

  const defaultRequest: Request = {
    method: 'GET',
    url: 'http://localhost/',
    headers: new Headers(),
    signal: controller.signal,
    ctx: defaultCtx,
    ...overrides,
  } as Request;

  return defaultRequest;
}
