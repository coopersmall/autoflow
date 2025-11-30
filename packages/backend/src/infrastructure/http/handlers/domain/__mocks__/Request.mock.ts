import type { Request } from '@backend/infrastructure/http/handlers/domain/Request';

export function getMockRequest(overrides: Partial<Request> = {}): Request {
  const defaultRequest: Request = {
    method: 'GET',
    url: 'http://localhost/',
    headers: new Headers(),
    context: {},
    ...overrides,
  } as Request;

  return defaultRequest;
}
