import type {
  OptionsAggregate,
  OptionsChain,
  OptionsContract,
} from '@core/domain/options/Options';
import type { ExtractMethods } from '@core/types';
import type { DefaultApi } from '@polygon.io/client-js';
import type { Result } from 'neverthrow';
import {
  getOptionsAggregates,
  getOptionsChain,
  getOptionsContract,
  listOptionsContracts,
} from './actions/index.ts';

export { createOptionsGateway };
export type { IOptionsGateway };

type IOptionsGateway = ExtractMethods<OptionsGateway>;

function createOptionsGateway(client: DefaultApi): IOptionsGateway {
  return Object.freeze(new OptionsGateway(client));
}

class OptionsGateway {
  constructor(
    private readonly client: DefaultApi,
    private readonly actions = {
      listOptionsContracts,
      getOptionsContract,
      getOptionsAggregates,
      getOptionsChain,
    },
  ) {}

  async listOptionsContracts(
    underlyingTicker?: string,
    opts?: {
      ticker?: string;
      contractType?: 'call' | 'put';
      expirationDate?: string;
      strikePrice?: number;
      expired?: boolean;
      limit?: number;
    },
  ): Promise<Result<OptionsContract[], unknown>> {
    return this.actions.listOptionsContracts(
      { client: this.client },
      {
        underlyingTicker,
        ticker: opts?.ticker,
        contractType: opts?.contractType,
        expirationDate: opts?.expirationDate,
        strikePrice: opts?.strikePrice,
        expired: opts?.expired,
        limit: opts?.limit,
      },
    );
  }

  async getOptionsContract(
    optionsTicker: string,
  ): Promise<Result<OptionsContract, unknown>> {
    return this.actions.getOptionsContract(
      { client: this.client },
      { optionsTicker },
    );
  }

  async getOptionsAggregates(
    optionsTicker: string,
    multiplier: number,
    timespan: 'minute' | 'hour' | 'day' | 'week' | 'month',
    from: string,
    to: string,
    opts?: {
      adjusted?: boolean;
      limit?: number;
    },
  ): Promise<Result<OptionsAggregate[], unknown>> {
    return this.actions.getOptionsAggregates(
      { client: this.client },
      {
        optionsTicker,
        multiplier,
        timespan,
        from,
        to,
        adjusted: opts?.adjusted,
        limit: opts?.limit,
      },
    );
  }

  async getOptionsChain(
    underlyingAsset: string,
    opts?: {
      strikePrice?: number;
      expirationDate?: string;
      contractType?: 'call' | 'put';
      strikePriceGte?: number;
      strikePriceGt?: number;
      strikePriceLte?: number;
      strikePriceLt?: number;
      expirationDateGte?: string;
      expirationDateGt?: string;
      expirationDateLte?: string;
      expirationDateLt?: string;
      limit?: number;
    },
  ): Promise<Result<OptionsChain, unknown>> {
    return this.actions.getOptionsChain(
      { client: this.client },
      {
        underlyingAsset,
        strikePrice: opts?.strikePrice,
        expirationDate: opts?.expirationDate,
        contractType: opts?.contractType,
        strikePriceGte: opts?.strikePriceGte,
        strikePriceGt: opts?.strikePriceGt,
        strikePriceLte: opts?.strikePriceLte,
        strikePriceLt: opts?.strikePriceLt,
        expirationDateGte: opts?.expirationDateGte,
        expirationDateGt: opts?.expirationDateGt,
        expirationDateLte: opts?.expirationDateLte,
        expirationDateLt: opts?.expirationDateLt,
        limit: opts?.limit,
      },
    );
  }
}
