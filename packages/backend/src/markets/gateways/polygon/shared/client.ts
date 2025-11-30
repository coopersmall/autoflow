import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import { type DefaultApi, restClient } from '@polygon.io/client-js';

export function getPolygonClient(
  appConfig: IAppConfigurationService,
): DefaultApi {
  const apiKey = appConfig.polygonKey;
  const url = 'https://api.polygon.io';
  return restClient(apiKey || '', url);
}
