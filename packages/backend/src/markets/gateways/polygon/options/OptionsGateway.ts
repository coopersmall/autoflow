import type {
  OptionsAggregate,
  OptionsChain,
  OptionsChainContract,
  OptionsContract,
} from '@core/domain/options/Options';
import {
  type DefaultApi,
  GetOptionsAggregatesTimespanEnum,
  GetOptionsChain200ResponseResultsInnerDetailsContractTypeEnum,
  GetOptionsChainContractTypeEnum,
  ListOptionsContractsContractTypeEnum,
} from '@polygon.io/client-js';
import { produce } from 'immer';
import { err, ok, type Result } from 'neverthrow';

export class OptionsGateway {
  constructor(private readonly client: DefaultApi) {}

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
    try {
      const response = await this.client.listOptionsContracts(
        underlyingTicker,
        opts?.ticker,
        opts?.contractType
          ? this.mapListOptionContractType(opts.contractType)
          : undefined,
        opts?.expirationDate,
        undefined,
        opts?.strikePrice,
        opts?.expired,
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
        opts?.limit,
      );
      if (!response.results) {
        return ok([]);
      }
      const contracts = response.results.map((contract) => ({
        ticker: contract.ticker || '',
        underlying: contract.underlying_ticker || underlyingTicker || '',
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

  async getOptionsContract(
    optionsTicker: string,
  ): Promise<Result<OptionsContract, unknown>> {
    try {
      const response = await this.client.getOptionsContract(optionsTicker);
      if (!response.results) {
        return err(new Error('No data found'));
      }
      const contract: OptionsContract = {
        ticker: response.results.ticker || optionsTicker,
        underlying: response.results.underlying_ticker || '',
        expirationDate: response.results.expiration_date || '',
        strikePrice: response.results.strike_price || 0,
        contractType:
          response.results.contract_type === 'call' ? 'call' : 'put',
        exerciseStyle: response.results.exercise_style,
        sharesPerContract: response.results.shares_per_contract || 100,
        cfi: response.results.cfi,
      };
      return ok(contract);
    } catch (error) {
      return err(error);
    }
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
    try {
      const response = await this.client.getOptionsAggregates(
        optionsTicker,
        multiplier,
        this.mapTimespan(timespan),
        from,
        to,
        opts?.adjusted,
        undefined,
        opts?.limit,
      );
      if (!response.results) {
        return ok([]);
      }
      const aggregates = response.results.map((bar) => ({
        ticker: optionsTicker,
        open: bar.o || 0,
        high: bar.h || 0,
        low: bar.l || 0,
        close: bar.c || 0,
        volume: bar.v || 0,
        timestamp: bar.t || 0,
        vwap: bar.vw,
        transactions: bar.n,
      }));
      return ok(aggregates);
    } catch (error) {
      return err(error);
    }
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
    try {
      const response = await this.client.getOptionsChain(
        underlyingAsset,
        opts?.strikePrice,
        opts?.expirationDate,
        opts?.contractType
          ? this.mapListChainContractType(opts.contractType)
          : undefined,
        opts?.strikePriceGte,
        opts?.strikePriceGt,
        opts?.strikePriceLte,
        opts?.strikePriceLt,
        opts?.expirationDateGte,
        opts?.expirationDateGt,
        opts?.expirationDateLte,
        opts?.expirationDateLt,
        undefined,
        opts?.limit,
        undefined,
      );
      if (!response.results) {
        return ok({
          underlying: underlyingAsset,
          contracts: [],
        });
      }

      const contracts: OptionsChainContract[] = response.results.map(
        (contract) => {
          const baseContract: OptionsChainContract = {
            ticker: contract.details?.ticker || '',
            underlying: underlyingAsset,
            contractType: this.mapGetOptionContractType(
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
        underlying: underlyingAsset,
        contracts,
      });
    } catch (error) {
      return err(error);
    }
  }

  private mapListChainContractType(
    type: 'call' | 'put',
  ): GetOptionsChainContractTypeEnum {
    switch (type) {
      case 'call':
        return GetOptionsChainContractTypeEnum.Call;
      case 'put':
        return GetOptionsChainContractTypeEnum.Put;
    }
  }

  private mapListOptionContractType(
    type: 'call' | 'put',
  ): ListOptionsContractsContractTypeEnum {
    switch (type) {
      case 'call':
        return ListOptionsContractsContractTypeEnum.Call;
      case 'put':
        return ListOptionsContractsContractTypeEnum.Put;
    }
  }

  private mapGetOptionContractType(
    type: GetOptionsChain200ResponseResultsInnerDetailsContractTypeEnum,
  ): 'call' | 'put' | 'other' {
    switch (type) {
      case GetOptionsChain200ResponseResultsInnerDetailsContractTypeEnum.Call:
        return 'call';
      case GetOptionsChain200ResponseResultsInnerDetailsContractTypeEnum.Put:
        return 'put';
      case GetOptionsChain200ResponseResultsInnerDetailsContractTypeEnum.Other:
        return 'other';
    }
  }

  private mapTimespan(
    timespan: 'minute' | 'hour' | 'day' | 'week' | 'month',
  ): GetOptionsAggregatesTimespanEnum {
    switch (timespan) {
      case 'minute':
        return GetOptionsAggregatesTimespanEnum.Minute;
      case 'hour':
        return GetOptionsAggregatesTimespanEnum.Hour;
      case 'day':
        return GetOptionsAggregatesTimespanEnum.Day;
      case 'week':
        return GetOptionsAggregatesTimespanEnum.Week;
      case 'month':
        return GetOptionsAggregatesTimespanEnum.Month;
    }
  }
}
