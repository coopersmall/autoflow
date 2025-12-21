import type { DefaultApi } from '@polygon.io/client-js';
import { err, ok, type Result } from 'neverthrow';
import { isDateInHolidays, isWeekend } from '../utils/dateUtils';
import { getMarketHolidays } from './getMarketHolidays';

export type GetNextTradingDayContext = {
  readonly client: DefaultApi;
};

export type GetNextTradingDayRequest = Record<string, never>;

export async function getNextTradingDay(
  ctx: GetNextTradingDayContext,
  _request: GetNextTradingDayRequest,
): Promise<Result<Date, unknown>> {
  try {
    const holidaysResult = await getMarketHolidays(ctx, {});
    if (holidaysResult.isErr()) {
      return err(holidaysResult.error);
    }

    const holidays = holidaysResult.value;
    let nextDay = new Date();
    nextDay = new Date(nextDay.setDate(nextDay.getDate() + 1));

    while (isWeekend(nextDay) || isDateInHolidays(nextDay, holidays)) {
      nextDay.setDate(nextDay.getDate() + 1);
    }

    return ok(nextDay);
  } catch (error) {
    return err(error);
  }
}
