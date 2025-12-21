import type { MarketStatus } from '@core/domain/markets/Markets';
import type { DefaultApi } from '@polygon.io/client-js';
import { err, ok, type Result } from 'neverthrow';
import {
  normalizeCurrencyStatus,
  normalizeIndicesStatus,
  normalizeMarketStatus,
} from '../utils/normalizers';

export type GetMarketStatusContext = {
  readonly client: DefaultApi;
};

export type GetMarketStatusRequest = Record<string, never>;

export async function getMarketStatus(
  ctx: GetMarketStatusContext,
  _request: GetMarketStatusRequest,
): Promise<Result<MarketStatus, unknown>> {
  try {
    const response = await ctx.client.getMarketStatus();

    const status: MarketStatus = {
      afterHours: response.afterHours || false,
      preMarket: response.earlyHours || false,
      exchanges: {
        nasdaq: normalizeMarketStatus(response.exchanges?.nasdaq),
        nyse: normalizeMarketStatus(response.exchanges?.nyse),
        otc: normalizeMarketStatus(response.exchanges?.otc),
      },
      currencies: {
        crypto: normalizeCurrencyStatus(response.currencies?.crypto),
        forex: normalizeCurrencyStatus(response.currencies?.fx),
      },
      indices: {
        cccy: normalizeIndicesStatus(response.indicesGroups?.cccy),
        cgi: normalizeIndicesStatus(response.indicesGroups?.cgi),
        dowJones: normalizeIndicesStatus(response.indicesGroups?.dow_jones),
        sp: normalizeIndicesStatus(response.indicesGroups?.s_and_p),
      },
      serverTime: response.serverTime || new Date().toISOString(),
    };

    return ok(status);
  } catch (error) {
    return err(error);
  }
}
