import { toNanoSeconds } from '@backend/markets/gateways/polygon/shared/utils';
import type { StockQuote } from '@core/domain/stocks/Stocks';
import type { DefaultApi } from '@polygon.io/client-js';
import { err, ok, type Result } from 'neverthrow';

export type GetStockQuotesContext = {
  readonly client: DefaultApi;
};

export interface GetStockQuotesRequest {
  readonly ticker: string;
  readonly timestamp?: Date;
  readonly limit?: number;
}

export async function getStockQuotes(
  ctx: GetStockQuotesContext,
  request: GetStockQuotesRequest,
): Promise<Result<StockQuote[], unknown>> {
  try {
    const response = await ctx.client.getStocksQuotes(
      request.ticker,
      String(toNanoSeconds(request.timestamp ?? new Date())),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      request.limit,
    );
    const quotes = (response.results ?? []).map((quote) => ({
      ticker: request.ticker,
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
