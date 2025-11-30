import { toNanoSeconds } from '@backend/markets/gateways/polygon/shared/utils';
import type {
  StockDetails,
  StockQuote,
  StockTrade,
} from '@core/domain/stocks/Stocks';
import type { DefaultApi } from '@polygon.io/client-js';
import { err, ok, type Result } from 'neverthrow';

export class StocksGateway {
  constructor(private readonly client: DefaultApi) {}

  async getStockQuotes(
    ticker: string,
    opts?: {
      timestamp?: Date;
      limit?: number;
    },
  ): Promise<Result<StockQuote[], unknown>> {
    try {
      const response = await this.client.getStocksQuotes(
        ticker,
        String(toNanoSeconds(opts?.timestamp ?? new Date())),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        opts?.limit,
      );
      const quotes = (response.results ?? []).map((quote) => ({
        ticker,
        bidPrice: quote.bid_price,
        askPrice: quote.ask_price,
        bidSize: quote.bid_size,
        askSize: quote.ask_size,
        timestamp: quote.participant_timestamp,
      }));
      return ok(quotes);
    } catch (error) {
      return err(error);
    }
  }

  async getLastStocksQuote(
    ticker: string,
  ): Promise<Result<StockQuote, unknown>> {
    try {
      const response = await this.client.getLastStocksQuote(ticker);
      if (!response.results) {
        return err(new Error('No data found'));
      }
      const quote: StockQuote = {
        ticker,
        bidPrice: response.results.P,
        askPrice: response.results.p,
        bidSize: response.results.S,
        askSize: response.results.s,
        timestamp: response.results.t,
      };
      return ok(quote);
    } catch (error) {
      return err(error);
    }
  }

  async getStockDetails(
    ticker: string,
    date?: Date,
  ): Promise<Result<StockDetails, unknown>> {
    try {
      const response = await this.client.getTicker(
        ticker,
        date ? date.toDateString() : undefined,
      );
      if (!response.results) {
        return err(new Error('No data found'));
      }
      const details: StockDetails = {
        ticker,
        name: response.results.name,
        market: response.results.market,
        locale: response.results.locale,
        primaryExchange: response.results.primary_exchange,
        type: response.results.type,
        active: response.results.active,
        currencyName: response.results.currency_name,
        cik: response.results.cik,
        compositeFigi: response.results.composite_figi,
        shareClassFigi: response.results.share_class_figi,
      };
      return ok(details);
    } catch (error) {
      return err(error);
    }
  }

  async getLastStocksTrade(
    ticker: string,
  ): Promise<Result<StockTrade, unknown>> {
    try {
      const response = await this.client.getLastStocksTrade(ticker);
      if (!response.results) {
        return err(new Error('No data found'));
      }
      const trade: StockTrade = {
        ticker,
        price: response.results.p,
        size: response.results.s,
        timestamp: response.results.t,
        conditions: response.results.c,
        exchange: response.results.x,
      };
      return ok(trade);
    } catch (error) {
      return err(error);
    }
  }
}
