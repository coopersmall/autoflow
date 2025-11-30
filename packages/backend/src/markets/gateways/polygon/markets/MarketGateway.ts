import type {
  Exchange,
  MarketHoliday,
  MarketStatus,
} from '@core/domain/markets/Markets';
import type { ExtractMethods } from '@core/types';
import type { DefaultApi } from '@polygon.io/client-js';
import type { Result } from 'neverthrow';
import {
  getMarketHolidays,
  getMarketStatus,
  getNextTradingDay,
  isHoliday,
  isMarketOpen,
  listExchanges,
} from './actions/index.ts';

export { createMarketGateway };
export type { IMarketGateway };

type IMarketGateway = ExtractMethods<MarketGateway>;

interface MarketGatewayActions {
  getMarketStatus: typeof getMarketStatus;
  getMarketHolidays: typeof getMarketHolidays;
  listExchanges: typeof listExchanges;
  isMarketOpen: typeof isMarketOpen;
  isHoliday: typeof isHoliday;
  getNextTradingDay: typeof getNextTradingDay;
}

function createMarketGateway(client: DefaultApi): IMarketGateway {
  return Object.freeze(new MarketGateway(client));
}

class MarketGateway {
  constructor(
    private readonly client: DefaultApi,
    private readonly actions: MarketGatewayActions = {
      getMarketStatus,
      getMarketHolidays,
      listExchanges,
      isMarketOpen,
      isHoliday,
      getNextTradingDay,
    },
  ) {}

  async getMarketStatus(): Promise<Result<MarketStatus, unknown>> {
    return this.actions.getMarketStatus({ client: this.client }, {});
  }

  async getMarketHolidays(): Promise<Result<MarketHoliday[], unknown>> {
    return this.actions.getMarketHolidays({ client: this.client }, {});
  }

  async listExchanges(opts?: {
    assetClass?: 'stocks' | 'options' | 'crypto' | 'fx';
    locale?: 'us' | 'global';
  }): Promise<Result<Exchange[], unknown>> {
    return this.actions.listExchanges(
      { client: this.client },
      {
        assetClass: opts?.assetClass,
        locale: opts?.locale,
      },
    );
  }

  async isMarketOpen(exchange?: string): Promise<Result<boolean, unknown>> {
    return this.actions.isMarketOpen({ client: this.client }, { exchange });
  }

  async isHoliday(
    date: Date,
    exchange?: string,
  ): Promise<Result<boolean, unknown>> {
    return this.actions.isHoliday({ client: this.client }, { date, exchange });
  }

  async getNextTradingDay(): Promise<Result<Date, unknown>> {
    return this.actions.getNextTradingDay({ client: this.client }, {});
  }
}
