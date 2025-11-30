import type { OptionsContract } from '@core/domain/options/Options';
import type { DefaultApi } from '@polygon.io/client-js';
import { err, ok, type Result } from 'neverthrow';

export type GetOptionsContractContext = {
  readonly client: DefaultApi;
};

export interface GetOptionsContractRequest {
  readonly optionsTicker: string;
}

export async function getOptionsContract(
  ctx: GetOptionsContractContext,
  request: GetOptionsContractRequest,
): Promise<Result<OptionsContract, unknown>> {
  try {
    const response = await ctx.client.getOptionsContract(request.optionsTicker);
    if (!response.results) {
      return err(new Error('No data found'));
    }
    const contract: OptionsContract = {
      ticker: response.results.ticker || request.optionsTicker,
      underlying: response.results.underlying_ticker || '',
      expirationDate: response.results.expiration_date || '',
      strikePrice: response.results.strike_price || 0,
      contractType: response.results.contract_type === 'call' ? 'call' : 'put',
      exerciseStyle: response.results.exercise_style,
      sharesPerContract: response.results.shares_per_contract || 100,
      cfi: response.results.cfi,
    };
    return ok(contract);
  } catch (error) {
    return err(error);
  }
}
