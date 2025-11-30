import type { MarketHoliday } from '@core/domain/markets/Markets';
import type { DefaultApi } from '@polygon.io/client-js';
import { err, ok, type Result } from 'neverthrow';
import { determineHolidayStatus } from '../utils/normalizers.ts';

export type GetMarketHolidaysContext = {
  readonly client: DefaultApi;
};

export type GetMarketHolidaysRequest = Record<string, never>;

export async function getMarketHolidays(
  ctx: GetMarketHolidaysContext,
  _request: GetMarketHolidaysRequest,
): Promise<Result<MarketHoliday[], unknown>> {
  try {
    const response = await ctx.client.getMarketHolidays();

    const holidays = response.map((holiday) => {
      const marketHoliday: MarketHoliday = {
        name: holiday.name || 'Unknown Holiday',
        date: holiday.date || '',
        exchange: holiday.exchange || 'US',
        open: holiday.open,
        close: holiday.close,
        status: determineHolidayStatus(holiday.open, holiday.close),
      };

      return marketHoliday;
    });

    return ok(holidays);
  } catch (error) {
    return err(error);
  }
}
