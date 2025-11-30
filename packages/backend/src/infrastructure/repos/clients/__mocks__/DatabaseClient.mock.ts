import { mock } from 'bun:test';

export function getMockedDatabaseClient() {
  const fn = mock((...args: unknown[]) => {
    if (args[0] && Array.isArray(args[0])) {
      return Promise.resolve([]);
    }
    return args[0];
  });
  return Object.assign(fn, {
    close: mock(),
  });
}
