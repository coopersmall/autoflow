import type { DefaultApi } from '@polygon.io/client-js';
import { err, ok, type Result } from 'neverthrow';
import { getMarketHolidays } from './getMarketHolidays';

export type IsHolidayContext = {
  readonly client: DefaultApi;
};

export interface IsHolidayRequest {
  readonly date: Date;
  readonly exchange?: string;
}

export async function isHoliday(
  ctx: IsHolidayContext,
  request: IsHolidayRequest,
): Promise<Result<boolean, unknown>> {
  try {
    const holidaysResult = await getMarketHolidays(ctx, {});
    if (holidaysResult.isErr()) {
      return err(holidaysResult.error);
    }

    const holidays = holidaysResult.value;
    const targetDate = request.date.toISOString().split('T')[0];

    const holiday = holidays.find((h) => {
      const matchesDate = h.date === targetDate;
      const matchesExchange =
        !request.exchange ||
        h.exchange.toLowerCase() === request.exchange.toLowerCase();
      return matchesDate && matchesExchange;
    });

    return ok(!!holiday);
  } catch (error) {
    return err(error);
  }
}
