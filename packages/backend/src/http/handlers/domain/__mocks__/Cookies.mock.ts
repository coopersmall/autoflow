import type { Cookies } from '@backend/http/handlers/domain/Cookies';

export function getMockCookieMap(entries: [string, string][] = []): Cookies {
  const cookieMap = {
    size: entries.length,
    get: (key: string) => {
      const entry = entries.find(([k]) => k === key);
      return entry ? entry[1] : null;
    },
    set: () => {},
    delete: () => {},
    toSetCookieHeaders: () => entries.map(([key, value]) => `${key}=${value}`),
  };

  return cookieMap as unknown as Cookies;
}
