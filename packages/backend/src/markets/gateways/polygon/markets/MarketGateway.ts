import type {
  Exchange,
  MarketHoliday,
  MarketStatus,
} from '@core/domain/markets/Markets';
import {
  type DefaultApi,
  ListExchanges200ResponseResultsInnerAssetClassEnum,
  ListExchanges200ResponseResultsInnerLocaleEnum,
  ListExchangesAssetClassEnum,
  ListExchangesLocaleEnum,
} from '@polygon.io/client-js';
import { err, ok, type Result } from 'neverthrow';

export class MarketGateway {
  constructor(private readonly client: DefaultApi) {}

  async getMarketStatus(): Promise<Result<MarketStatus, unknown>> {
    try {
      const response = await this.client.getMarketStatus();

      const status: MarketStatus = {
        afterHours: response.afterHours || false,
        preMarket: response.earlyHours || false,
        exchanges: {
          nasdaq: this.normalizeMarketStatus(response.exchanges?.nasdaq),
          nyse: this.normalizeMarketStatus(response.exchanges?.nyse),
          otc: this.normalizeMarketStatus(response.exchanges?.otc),
        },
        currencies: {
          crypto: this.normalizeCurrencyStatus(response.currencies?.crypto),
          forex: this.normalizeCurrencyStatus(response.currencies?.fx),
        },
        indices: {
          cccy: this.normalizeIndicesStatus(response.indicesGroups?.cccy),
          cgi: this.normalizeIndicesStatus(response.indicesGroups?.cgi),
          dowJones: this.normalizeIndicesStatus(
            response.indicesGroups?.dow_jones,
          ),
          sp: this.normalizeIndicesStatus(response.indicesGroups?.s_and_p),
        },
        serverTime: response.serverTime || new Date().toISOString(),
      };

      return ok(status);
    } catch (error) {
      return err(error);
    }
  }

  async getMarketHolidays(): Promise<Result<MarketHoliday[], unknown>> {
    try {
      const response = await this.client.getMarketHolidays();

      const holidays = response.map((holiday) => {
        const marketHoliday: MarketHoliday = {
          name: holiday.name || 'Unknown Holiday',
          date: holiday.date || '',
          exchange: holiday.exchange || 'US',
          open: holiday.open,
          close: holiday.close,
          status: this.determineHolidayStatus(holiday.open, holiday.close),
        };

        return marketHoliday;
      });

      return ok(holidays);
    } catch (error) {
      return err(error);
    }
  }

  async listExchanges(opts?: {
    assetClass?: 'stocks' | 'options' | 'crypto' | 'fx';
    locale?: 'us' | 'global';
  }): Promise<Result<Exchange[], unknown>> {
    try {
      const assetClass = opts?.assetClass
        ? this.mapAssetClass(opts.assetClass)
        : undefined;
      const locale = opts?.locale ? this.mapLocale(opts.locale) : undefined;

      const response = await this.client.listExchanges(assetClass, locale);

      if (!response.results) {
        return ok([]);
      }

      const exchanges = response.results.map((exchange) => {
        const mappedExchange: Exchange = {
          id: exchange.id,
          name: exchange.name || '',
          acronym: exchange.acronym || '',
          assetClass: this.mapAssetClassBack(exchange.asset_class),
          locale: this.mapLocaleBack(exchange.locale),
          mic: exchange.mic,
          operatingMic: exchange.operating_mic,
          participantId: exchange.participant_id,
          type: exchange.type || '',
          url: exchange.url,
        };

        return mappedExchange;
      });

      return ok(exchanges);
    } catch (error) {
      return err(error);
    }
  }

  async isMarketOpen(exchange?: string): Promise<Result<boolean, unknown>> {
    try {
      const statusResult = await this.getMarketStatus();
      if (statusResult.isErr()) {
        return err(statusResult.error);
      }

      const status = statusResult.value;

      if (!exchange) {
        return ok(status.exchanges.nyse === 'open');
      }

      switch (exchange.toLowerCase()) {
        case 'nyse':
          return ok(status.exchanges.nyse === 'open');
        case 'nasdaq':
          return ok(status.exchanges.nasdaq === 'open');
        case 'otc':
          return ok(status.exchanges.otc === 'open');
        default:
          return ok(status.exchanges.nyse === 'open');
      }
    } catch (error) {
      return err(error);
    }
  }

  async isHoliday(
    date: Date,
    exchange?: string,
  ): Promise<Result<boolean, unknown>> {
    try {
      const holidaysResult = await this.getMarketHolidays();
      if (holidaysResult.isErr()) {
        return err(holidaysResult.error);
      }

      const holidays = holidaysResult.value;
      const targetDate = date.toISOString().split('T')[0];

      const holiday = holidays.find((h) => {
        const matchesDate = h.date === targetDate;
        const matchesExchange =
          !exchange || h.exchange.toLowerCase() === exchange.toLowerCase();
        return matchesDate && matchesExchange;
      });

      return ok(!!holiday);
    } catch (error) {
      return err(error);
    }
  }

  async getNextTradingDay(): Promise<Result<Date, unknown>> {
    try {
      const holidaysResult = await this.getMarketHolidays();
      if (holidaysResult.isErr()) {
        return err(holidaysResult.error);
      }

      const holidays = holidaysResult.value;
      let nextDay = new Date();
      nextDay = new Date(nextDay.setDate(nextDay.getDate() + 1));

      while (
        this.isWeekend(nextDay) ||
        this.isDateInHolidays(nextDay, holidays)
      ) {
        nextDay.setDate(nextDay.getDate() + 1);
      }

      return ok(nextDay);
    } catch (error) {
      return err(error);
    }
  }

  private normalizeMarketStatus(
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

  private normalizeCurrencyStatus(status?: string): 'open' | 'closed' {
    if (!status) return 'closed';
    return status.toLowerCase() === 'open' ? 'open' : 'closed';
  }

  private normalizeIndicesStatus(status?: string): 'open' | 'closed' {
    if (!status) return 'closed';
    return status.toLowerCase() === 'open' ? 'open' : 'closed';
  }

  private determineHolidayStatus(
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

  private mapAssetClass(
    assetClass: 'stocks' | 'options' | 'crypto' | 'fx',
  ): ListExchangesAssetClassEnum {
    switch (assetClass) {
      case 'stocks':
        return ListExchangesAssetClassEnum.Stocks;
      case 'options':
        return ListExchangesAssetClassEnum.Options;
      case 'crypto':
        return ListExchangesAssetClassEnum.Crypto;
      case 'fx':
        return ListExchangesAssetClassEnum.Fx;
    }
  }

  private mapAssetClassBack(
    assetClass: ListExchanges200ResponseResultsInnerAssetClassEnum,
  ): 'stocks' | 'options' | 'crypto' | 'fx' | 'futures' {
    switch (assetClass) {
      case ListExchanges200ResponseResultsInnerAssetClassEnum.Stocks:
        return 'stocks';
      case ListExchanges200ResponseResultsInnerAssetClassEnum.Options:
        return 'options';
      case ListExchanges200ResponseResultsInnerAssetClassEnum.Crypto:
        return 'crypto';
      case ListExchanges200ResponseResultsInnerAssetClassEnum.Fx:
        return 'fx';
      case ListExchanges200ResponseResultsInnerAssetClassEnum.Futures:
        return 'stocks';
    }
  }

  private mapLocale(locale: 'us' | 'global'): ListExchangesLocaleEnum {
    switch (locale) {
      case 'us':
        return ListExchangesLocaleEnum.Us;
      case 'global':
        return ListExchangesLocaleEnum.Global;
    }
  }

  private mapLocaleBack(
    locale: ListExchanges200ResponseResultsInnerLocaleEnum,
  ): 'us' | 'global' {
    switch (locale) {
      case ListExchanges200ResponseResultsInnerLocaleEnum.Us:
        return 'us';
      case ListExchanges200ResponseResultsInnerLocaleEnum.Global:
        return 'global';
    }
  }

  private isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  private isDateInHolidays(date: Date, holidays: MarketHoliday[]): boolean {
    const dateString = date.toISOString().split('T')[0];
    return holidays.some((holiday) => holiday.date === dateString);
  }
}
