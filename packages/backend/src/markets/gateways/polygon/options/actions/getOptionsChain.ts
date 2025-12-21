import type {
  OptionsChain,
  OptionsChainContract,
} from '@core/domain/options/Options';
import type { DefaultApi } from '@polygon.io/client-js';
import { produce } from 'immer';
import { err, ok, type Result } from 'neverthrow';
import {
  mapGetOptionContractType,
  mapListChainContractType,
} from '../utils/mappers';

export type GetOptionsChainContext = {
  readonly client: DefaultApi;
};

export interface GetOptionsChainRequest {
  readonly underlyingAsset: string;
  readonly strikePrice?: number;
  readonly expirationDate?: string;
  readonly contractType?: 'call' | 'put';
  readonly strikePriceGte?: number;
  readonly strikePriceGt?: number;
  readonly strikePriceLte?: number;
  readonly strikePriceLt?: number;
  readonly expirationDateGte?: string;
  readonly expirationDateGt?: string;
  readonly expirationDateLte?: string;
  readonly expirationDateLt?: string;
  readonly limit?: number;
}

export async function getOptionsChain(
  ctx: GetOptionsChainContext,
  request: GetOptionsChainRequest,
): Promise<Result<OptionsChain, unknown>> {
  try {
    const response = await ctx.client.getOptionsChain(
      request.underlyingAsset,
      request.strikePrice,
      request.expirationDate,
      request.contractType
        ? mapListChainContractType(request.contractType)
        : undefined,
      request.strikePriceGte,
      request.strikePriceGt,
      request.strikePriceLte,
      request.strikePriceLt,
      request.expirationDateGte,
      request.expirationDateGt,
      request.expirationDateLte,
      request.expirationDateLt,
      undefined,
      request.limit,
      undefined,
    );
    if (!response.results) {
      return ok({
        underlying: request.underlyingAsset,
        contracts: [],
      });
    }

    const contracts: OptionsChainContract[] = response.results.map(
      (contract) => {
        const baseContract: OptionsChainContract = {
          ticker: contract.details?.ticker || '',
          underlying: request.underlyingAsset,
          contractType: mapGetOptionContractType(
            contract.details?.contract_type,
          ),
          expirationDate: contract.details?.expiration_date || '',
          strikePrice: contract.details?.strike_price || 0,
          exerciseStyle: contract.details?.exercise_style,
          sharesPerContract: contract.details?.shares_per_contract || 100,
          breakEvenPrice: contract.break_even_price,
        };

        return produce(baseContract, (draft) => {
          if (contract.day) {
            draft.day = {
              change: contract.day.change || 0,
              changePercent: contract.day.change_percent || 0,
              close: contract.day.close || 0,
              high: contract.day.high || 0,
              low: contract.day.low || 0,
              open: contract.day.open || 0,
              previousClose: contract.day.previous_close || 0,
              volume: contract.day.volume || 0,
            };
          }

          if (contract.last_quote) {
            draft.lastQuote = {
              ask: contract.last_quote.ask || 0,
              askSize: contract.last_quote.ask_size || 0,
              askExchange: contract.last_quote.ask_exchange,
              bid: contract.last_quote.bid || 0,
              bidSize: contract.last_quote.bid_size || 0,
              bidExchange: contract.last_quote.bid_exchange,
              timestamp: contract.last_quote.last_updated || 0,
            };
          }

          if (contract.last_trade) {
            draft.lastTrade = {
              price: contract.last_trade.price || 0,
              size: contract.last_trade.size || 0,
              conditions: contract.last_trade.conditions,
              exchange: contract.last_trade.exchange || 0,
              timestamp: contract.last_trade.sip_timestamp || 0,
            };
          }
        });
      },
    );

    return ok({
      underlying: request.underlyingAsset,
      contracts,
    });
  } catch (error) {
    return err(error);
  }
}
