import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import {
  createMarketGateway,
  type IMarketGateway,
} from './markets/MarketGateway.ts';
import {
  createOptionsGateway,
  type IOptionsGateway,
} from './options/OptionsGateway.ts';
import { getPolygonClient } from './shared/client.ts';
import {
  createStocksGateway,
  type IStocksGateway,
} from './stocks/StocksGateway.ts';

// Export gateway types and factories
export {
  createMarketGateway,
  type IMarketGateway,
} from './markets/MarketGateway.ts';
export {
  createOptionsGateway,
  type IOptionsGateway,
} from './options/OptionsGateway.ts';
export {
  createStocksGateway,
  type IStocksGateway,
} from './stocks/StocksGateway.ts';

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
