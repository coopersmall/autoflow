import type { OptionsContract } from '@core/domain/options/Options';
import type { DefaultApi } from '@polygon.io/client-js';
import { err, ok, type Result } from 'neverthrow';
import { mapListOptionContractType } from '../utils/mappers.ts';

export type ListOptionsContractsContext = {
  readonly client: DefaultApi;
};

export interface ListOptionsContractsRequest {
  readonly underlyingTicker?: string;
  readonly ticker?: string;
  readonly contractType?: 'call' | 'put';
  readonly expirationDate?: string;
  readonly strikePrice?: number;
  readonly expired?: boolean;
  readonly limit?: number;
}

export async function listOptionsContracts(
  ctx: ListOptionsContractsContext,
  request: ListOptionsContractsRequest,
): Promise<Result<OptionsContract[], unknown>> {
  try {
    const response = await ctx.client.listOptionsContracts(
      request.underlyingTicker,
      request.ticker,
      request.contractType
        ? mapListOptionContractType(request.contractType)
        : undefined,
      request.expirationDate,
      undefined,
      request.strikePrice,
      request.expired,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      request.limit,
    );
    if (!response.results) {
      return ok([]);
    }
    const contracts = response.results.map((contract) => ({
      ticker: contract.ticker || '',
      underlying: contract.underlying_ticker || request.underlyingTicker || '',
      expirationDate: contract.expiration_date || '',
      strikePrice: contract.strike_price || 0,
      contractType:
        contract.contract_type === 'call'
          ? ('call' as const)
          : ('put' as const),
      exerciseStyle: contract.exercise_style,
      sharesPerContract: contract.shares_per_contract || 100,
      cfi: contract.cfi,
    }));
    return ok(contracts);
  } catch (error) {
    return err(error);
  }
}
