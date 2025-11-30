import type { StockTrade } from '@core/domain/stocks/Stocks';
import type { DefaultApi } from '@polygon.io/client-js';
import { err, ok, type Result } from 'neverthrow';

export type GetLastStocksTradeContext = {
  readonly client: DefaultApi;
};

export interface GetLastStocksTradeRequest {
  readonly ticker: string;
}

export async function getLastStocksTrade(
  ctx: GetLastStocksTradeContext,
  request: GetLastStocksTradeRequest,
): Promise<Result<StockTrade, unknown>> {
  try {
    const response = await ctx.client.getLastStocksTrade(request.ticker);
    if (!response.results) {
      return err(new Error('No data found'));
    }
    const trade: StockTrade = {
      ticker: request.ticker,
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
