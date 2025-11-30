import { StandardCache } from '@backend/infrastructure/cache/StandardCache';
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IIntegrationsCache } from '@backend/integrations/domain/IntegrationsCache';
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
