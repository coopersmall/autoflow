import type { StockQuote } from '@core/domain/stocks/Stocks';
import type { DefaultApi } from '@polygon.io/client-js';
import { err, ok, type Result } from 'neverthrow';

export type GetLastStocksQuoteContext = {
  readonly client: DefaultApi;
};

export interface GetLastStocksQuoteRequest {
  readonly ticker: string;
}

export async function getLastStocksQuote(
  ctx: GetLastStocksQuoteContext,
  request: GetLastStocksQuoteRequest,
): Promise<Result<StockQuote, unknown>> {
  try {
    const response = await ctx.client.getLastStocksQuote(request.ticker);
    if (!response.results) {
      return err(new Error('No data found'));
    }
    const quote: StockQuote = {
      ticker: request.ticker,
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
