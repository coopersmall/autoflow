/**
 * Status normalization utilities for market data.
 *
 * These pure functions normalize API response status strings into
 * our domain-specific status types.
 */

export function normalizeMarketStatus(
  status?: string,
): 'open' | 'closed' | 'extended-hours' {
  if (!status) return 'closed';
  switch (status.toLowerCase()) {
    case 'open':
      return 'open';
    case 'extended-hours':
      return 'extended-hours';
    default:
      return 'closed';
  }
}

export function normalizeCurrencyStatus(status?: string): 'open' | 'closed' {
  if (!status) return 'closed';
  return status.toLowerCase() === 'open' ? 'open' : 'closed';
}

export function normalizeIndicesStatus(status?: string): 'open' | 'closed' {
  if (!status) return 'closed';
  return status.toLowerCase() === 'open' ? 'open' : 'closed';
}

export function determineHolidayStatus(
  open?: string,
  close?: string,
): 'closed' | 'early-close' | 'late-open' {
  if (!open && !close) return 'closed';
  if (open && close) {
    const openTime = new Date(`1970-01-01T${open}`);
    const closeTime = new Date(`1970-01-01T${close}`);
    const normalOpen = new Date('1970-01-01T09:30:00');
    const normalClose = new Date('1970-01-01T16:00:00');

    if (openTime.getTime() > normalOpen.getTime()) return 'late-open';
    if (closeTime.getTime() < normalClose.getTime()) return 'early-close';
  }
  return 'closed';
}
