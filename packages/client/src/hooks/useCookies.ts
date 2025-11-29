import type { HttpRequestError, UserId } from '@autoflow/core';
import { isString } from 'lodash';
import { err, ok, type Result } from 'neverthrow';
import { useCallback } from 'react';
import { useCookies as useReactCookies } from 'react-cookie';
import { None, type Option, Some } from 'ts-option';
import { useLocalClient } from './useLocalClient';

export function useAuthCookie() {
  const [cookies, setCookie, removeCookie] = useReactCookies();

  const getAuthCookie = useCallback((): Option<string> => {
    return isString(cookies.auth) ? new Some(cookies.auth) : new None();
  }, [cookies]);

  const setAuthCookie = useCallback(
    (value: string) => {
      setCookie('auth', value);
    },
    [setCookie],
  );

  const removeAuthCookie = useCallback(() => {
    removeCookie('auth');
  }, [removeCookie]);

  const client = useLocalClient();

  const requestAuthCookie = useCallback(
    async (userId: UserId): Promise<Result<string, HttpRequestError>> => {
      const response = await client.requestAuthCookie(userId);
      if (response.isErr()) {
        return err(response.error);
      }
      const { claim } = response.value;
      setAuthCookie(claim);
      return ok(claim);
    },
    [client, setAuthCookie],
  );

  return {
    getAuthCookie,
    setAuthCookie,
    removeAuthCookie,
    requestAuthCookie,
  };
}
