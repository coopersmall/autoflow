import type {
  StockDetails,
  StockQuote,
  StockTrade,
} from '@core/domain/stocks/Stocks';
import type { ExtractMethods } from '@core/types';
import type { DefaultApi } from '@polygon.io/client-js';
import type { Result } from 'neverthrow';
import {
  getLastStocksQuote,
  getLastStocksTrade,
  getStockDetails,
  getStockQuotes,
} from './actions/index.ts';

export { createStocksGateway };
export type { IStocksGateway };

type IStocksGateway = ExtractMethods<StocksGateway>;

interface StocksGatewayActions {
  getStockQuotes: typeof getStockQuotes;
  getLastStocksQuote: typeof getLastStocksQuote;
  getStockDetails: typeof getStockDetails;
  getLastStocksTrade: typeof getLastStocksTrade;
}

function createStocksGateway(client: DefaultApi): IStocksGateway {
  return Object.freeze(new StocksGateway(client));
}

class StocksGateway {
  constructor(
    private readonly client: DefaultApi,
    private readonly actions: StocksGatewayActions = {
      getStockQuotes,
      getLastStocksQuote,
      getStockDetails,
      getLastStocksTrade,
    },
  ) {}

  async getStockQuotes(
    ticker: string,
    opts?: {
      timestamp?: Date;
      limit?: number;
    },
  ): Promise<Result<StockQuote[], unknown>> {
    return this.actions.getStockQuotes(
      { client: this.client },
      {
        ticker,
        timestamp: opts?.timestamp,
        limit: opts?.limit,
      },
    );
  }

  async getLastStocksQuote(
    ticker: string,
  ): Promise<Result<StockQuote, unknown>> {
    return this.actions.getLastStocksQuote({ client: this.client }, { ticker });
  }

  async getStockDetails(
    ticker: string,
    date?: Date,
  ): Promise<Result<StockDetails, unknown>> {
    return this.actions.getStockDetails(
      { client: this.client },
      { ticker, date },
    );
  }

  async getLastStocksTrade(
    ticker: string,
  ): Promise<Result<StockTrade, unknown>> {
    return this.actions.getLastStocksTrade({ client: this.client }, { ticker });
  }
}
