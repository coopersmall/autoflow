import type { Exchange } from '@core/domain/markets/Markets';
import type { DefaultApi } from '@polygon.io/client-js';
import { err, ok, type Result } from 'neverthrow';
import {
  mapAssetClass,
  mapAssetClassBack,
  mapLocale,
  mapLocaleBack,
} from '../utils/mappers';

export type ListExchangesContext = {
  readonly client: DefaultApi;
};

export interface ListExchangesRequest {
  readonly assetClass?: 'stocks' | 'options' | 'crypto' | 'fx';
  readonly locale?: 'us' | 'global';
}

export async function listExchanges(
  ctx: ListExchangesContext,
  request: ListExchangesRequest,
): Promise<Result<Exchange[], unknown>> {
  try {
    const assetClass = request.assetClass
      ? mapAssetClass(request.assetClass)
      : undefined;
    const locale = request.locale ? mapLocale(request.locale) : undefined;

    const response = await ctx.client.listExchanges(assetClass, locale);

    if (!response.results) {
      return ok([]);
    }

    const exchanges = response.results.map((exchange) => {
      const mappedExchange: Exchange = {
        id: exchange.id,
        name: exchange.name || '',
        acronym: exchange.acronym || '',
        assetClass: mapAssetClassBack(exchange.asset_class),
        locale: mapLocaleBack(exchange.locale),
        mic: exchange.mic,
        operatingMic: exchange.operating_mic,
        participantId: exchange.participant_id,
        type: exchange.type || '',
        url: exchange.url,
      };

      return mappedExchange;
    });

    return ok(exchanges);
  } catch (error) {
    return err(error);
  }
}
