/**
 * Enum mapping utilities for market data.
 *
 * These pure functions map between our domain types and Polygon API enum types.
 */

import {
  ListExchanges200ResponseResultsInnerAssetClassEnum,
  ListExchanges200ResponseResultsInnerLocaleEnum,
  ListExchangesAssetClassEnum,
  ListExchangesLocaleEnum,
} from '@polygon.io/client-js';

export function mapAssetClass(
  assetClass: 'stocks' | 'options' | 'crypto' | 'fx',
): ListExchangesAssetClassEnum {
  switch (assetClass) {
    case 'stocks':
      return ListExchangesAssetClassEnum.Stocks;
    case 'options':
      return ListExchangesAssetClassEnum.Options;
    case 'crypto':
      return ListExchangesAssetClassEnum.Crypto;
    case 'fx':
      return ListExchangesAssetClassEnum.Fx;
  }
}

export function mapAssetClassBack(
  assetClass: ListExchanges200ResponseResultsInnerAssetClassEnum,
): 'stocks' | 'options' | 'crypto' | 'fx' | 'futures' {
  switch (assetClass) {
    case ListExchanges200ResponseResultsInnerAssetClassEnum.Stocks:
      return 'stocks';
    case ListExchanges200ResponseResultsInnerAssetClassEnum.Options:
      return 'options';
    case ListExchanges200ResponseResultsInnerAssetClassEnum.Crypto:
      return 'crypto';
    case ListExchanges200ResponseResultsInnerAssetClassEnum.Fx:
      return 'fx';
    case ListExchanges200ResponseResultsInnerAssetClassEnum.Futures:
      return 'stocks';
  }
}

export function mapLocale(locale: 'us' | 'global'): ListExchangesLocaleEnum {
  switch (locale) {
    case 'us':
      return ListExchangesLocaleEnum.Us;
    case 'global':
      return ListExchangesLocaleEnum.Global;
  }
}

export function mapLocaleBack(
  locale: ListExchanges200ResponseResultsInnerLocaleEnum,
): 'us' | 'global' {
  switch (locale) {
    case ListExchanges200ResponseResultsInnerLocaleEnum.Us:
      return 'us';
    case ListExchanges200ResponseResultsInnerLocaleEnum.Global:
      return 'global';
  }
}
