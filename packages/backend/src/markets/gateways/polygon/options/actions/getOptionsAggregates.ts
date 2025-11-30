import type { OptionsAggregate } from '@core/domain/options/Options';
import type { DefaultApi } from '@polygon.io/client-js';
import { err, ok, type Result } from 'neverthrow';
import { mapTimespan } from '../utils/mappers.ts';

export type GetOptionsAggregatesContext = {
  readonly client: DefaultApi;
};

export interface GetOptionsAggregatesRequest {
  readonly optionsTicker: string;
  readonly multiplier: number;
  readonly timespan: 'minute' | 'hour' | 'day' | 'week' | 'month';
  readonly from: string;
  readonly to: string;
  readonly adjusted?: boolean;
  readonly limit?: number;
}

export async function getOptionsAggregates(
  ctx: GetOptionsAggregatesContext,
  request: GetOptionsAggregatesRequest,
): Promise<Result<OptionsAggregate[], unknown>> {
  try {
    const response = await ctx.client.getOptionsAggregates(
      request.optionsTicker,
      request.multiplier,
      mapTimespan(request.timespan),
      request.from,
      request.to,
      request.adjusted,
      undefined,
      request.limit,
    );
    if (!response.results) {
      return ok([]);
    }
    const aggregates = response.results.map((bar) => ({
      ticker: request.optionsTicker,
      open: bar.o || 0,
      high: bar.h || 0,
      low: bar.l || 0,
      close: bar.c || 0,
      volume: bar.v || 0,
      timestamp: bar.t || 0,
      vwap: bar.vw,
      transactions: bar.n,
    }));
    return ok(aggregates);
  } catch (error) {
    return err(error);
  }
}
