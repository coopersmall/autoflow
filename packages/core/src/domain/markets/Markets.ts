export const exchanges = ['nasdaq', 'nyse', 'otc'] as const;
export type ExchangeType = (typeof exchanges)[number];

export const currencies = ['crypto', 'forex'] as const;
export type CurrencyType = (typeof currencies)[number];

export const indices = ['sp', 'dowJones', 'cccy', 'cgi'] as const;
export type IndexType = (typeof indices)[number];

export const locales = ['us', 'global'] as const;
export type Locale = (typeof locales)[number];

export const assetClasses = [
  'stocks',
  'options',
  'crypto',
  'fx',
  'indices',
  'futures',
] as const;
export type AssetClass = (typeof assetClasses)[number];

export const marketOpenStatuses = ['open', 'closed', 'extended-hours'] as const;
export type MarketOpenStatus = (typeof marketOpenStatuses)[number];

export const marketHolidayStatuses = [
  'closed',
  'early-close',
  'late-open',
] as const;
export type MarketHolidayStatus = (typeof marketHolidayStatuses)[number];

export const currencyOpenStatuses = ['open', 'closed'] as const;
export type CurrencyOpenStatus = (typeof currencyOpenStatuses)[number];

export const indicesOpenStatuses = ['open', 'closed'] as const;
export type IndicesOpenStatus = (typeof indicesOpenStatuses)[number];

export interface MarketStatus {
  afterHours: boolean;
  preMarket: boolean;
  exchanges: Record<ExchangeType, MarketOpenStatus>;
  currencies: Record<CurrencyType, CurrencyOpenStatus>;
  indices: Record<IndexType, IndicesOpenStatus>;
  serverTime: string;
}

export interface MarketHoliday {
  name: string;
  date: string;
  exchange: string;
  open?: string;
  close?: string;
  status: MarketHolidayStatus;
}

export interface Exchange {
  id: number;
  name: string;
  acronym: string;
  assetClass: AssetClass;
  locale: Locale;
  mic?: string;
  operatingMic?: string;
  participantId?: string;
  type: string;
  url?: string;
}
