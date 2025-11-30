import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import { MarketGateway } from './markets/MarketGateway';
import { OptionsGateway } from './options/OptionsGateway';
import { getPolygonClient } from './shared/client';
import { StocksGateway } from './stocks/StocksGateway';

// Export gateway classes
export { MarketGateway } from './markets/MarketGateway';
export { OptionsGateway } from './options/OptionsGateway';
export { StocksGateway } from './stocks/StocksGateway';

export interface PolygonGateway {
  stocks: StocksGateway;
  markets: MarketGateway;
  options: OptionsGateway;
}

export function createPolygonGateway(
  appConfig: IAppConfigurationService,
): PolygonGateway {
  const client = getPolygonClient(appConfig);

  return {
    stocks: new StocksGateway(client),
    markets: new MarketGateway(client),
    options: new OptionsGateway(client),
  };
}
