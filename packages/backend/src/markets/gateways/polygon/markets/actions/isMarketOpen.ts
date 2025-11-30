import type { DefaultApi } from '@polygon.io/client-js';
import { err, ok, type Result } from 'neverthrow';
import { getMarketStatus } from './getMarketStatus.ts';

export type IsMarketOpenContext = {
  readonly client: DefaultApi;
};

export interface IsMarketOpenRequest {
  readonly exchange?: string;
}

export async function isMarketOpen(
  ctx: IsMarketOpenContext,
  request: IsMarketOpenRequest,
): Promise<Result<boolean, unknown>> {
  try {
    const statusResult = await getMarketStatus(ctx, {});
    if (statusResult.isErr()) {
      return err(statusResult.error);
    }

    const status = statusResult.value;

    if (!request.exchange) {
      return ok(status.exchanges.nyse === 'open');
    }

    switch (request.exchange.toLowerCase()) {
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
