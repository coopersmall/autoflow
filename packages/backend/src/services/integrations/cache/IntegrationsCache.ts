import { StandardCache } from '@backend/cache/StandardCache';
import type { ILogger } from '@backend/logger/Logger';
import type { IAppConfigurationService } from '@backend/services/configuration/AppConfigurationService';
import type { IIntegrationsCache } from '@backend/services/integrations/domain/IntegrationsCache';
import type { IntegrationId } from '@core/domain/integrations/BaseIntegration';
import type { Integration } from '@core/domain/integrations/Integration';
import { validIntegration } from '@core/domain/integrations/validation/validIntegration';

export function createIntegrationsCache(options: {
  logger: ILogger;
  appConfig: IAppConfigurationService;
  ttlSeconds?: number;
}): IIntegrationsCache {
  return new IntegrationsCache('integrations', {
    logger: options.logger,
    appConfig: options.appConfig,
    ttlSeconds: options.ttlSeconds,
  });
}

class IntegrationsCache
  extends StandardCache<IntegrationId, Integration>
  implements IIntegrationsCache
{
  constructor(
    namespace: string,
    options: {
      logger: ILogger;
      appConfig: IAppConfigurationService;
      ttlSeconds?: number;
    },
  ) {
    super(namespace, {
      ...options,
      validator: validIntegration,
    });
  }
}
