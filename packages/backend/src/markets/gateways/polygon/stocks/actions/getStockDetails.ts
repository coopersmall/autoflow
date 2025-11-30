import type { StockDetails } from '@core/domain/stocks/Stocks';
import type { DefaultApi } from '@polygon.io/client-js';
import { err, ok, type Result } from 'neverthrow';

export type GetStockDetailsContext = {
  readonly client: DefaultApi;
};

export interface GetStockDetailsRequest {
  readonly ticker: string;
  readonly date?: Date;
}

export async function getStockDetails(
  ctx: GetStockDetailsContext,
  request: GetStockDetailsRequest,
): Promise<Result<StockDetails, unknown>> {
  try {
    const response = await ctx.client.getTicker(
      request.ticker,
      request.date ? request.date.toDateString() : undefined,
    );
    if (!response.results) {
      return err(new Error('No data found'));
    }
    const details: StockDetails = {
      ticker: request.ticker,
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
