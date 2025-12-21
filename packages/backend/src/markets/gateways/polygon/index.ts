import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import {
  createMarketGateway,
  type IMarketGateway,
} from './markets/MarketGateway';
import {
  createOptionsGateway,
  type IOptionsGateway,
} from './options/OptionsGateway';
import { getPolygonClient } from './shared/client';
import {
  createStocksGateway,
  type IStocksGateway,
} from './stocks/StocksGateway';

// Export gateway types and factories
export {
  createMarketGateway,
  type IMarketGateway,
} from './markets/MarketGateway';
export {
  createOptionsGateway,
  type IOptionsGateway,
} from './options/OptionsGateway';
export {
  createStocksGateway,
  type IStocksGateway,
} from './stocks/StocksGateway';

export interface PolygonGateway {
  stocks: IStocksGateway;
  markets: IMarketGateway;
  options: IOptionsGateway;
}

export function createPolygonGateway(
  appConfig: IAppConfigurationService,
): PolygonGateway {
  const client = getPolygonClient(appConfig);

  return Object.freeze({
    stocks: createStocksGateway(client),
    markets: createMarketGateway(client),
    options: createOptionsGateway(client),
  });
}
