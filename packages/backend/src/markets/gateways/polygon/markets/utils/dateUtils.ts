/**
 * Date utilities for market data.
 *
 * These pure functions help with date calculations related to trading days.
 */

import type { MarketHoliday } from '@core/domain/markets/Markets';

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function isDateInHolidays(
  date: Date,
  holidays: MarketHoliday[],
): boolean {
  const dateString = date.toISOString().split('T')[0];
  return holidays.some((holiday) => holiday.date === dateString);
}
