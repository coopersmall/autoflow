import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import { StandardService } from '@backend/infrastructure/services/StandardService';
import {
  type Integration,
  IntegrationId,
} from '@core/domain/integrations/Integration';
import { createIntegrationsCache } from '../cache/IntegrationsCache';
import type { IIntegrationsService } from '../domain/IntegrationsService';
import { createIntegrationsRepo } from '../repos/IntegrationsRepo';

export { createIntegrationsService };

function createIntegrationsService(
  ctx: IntegrationsServiceContext,
): IIntegrationsService {
  return new IntegrationsService(ctx);
}

interface IntegrationsServiceContext {
  logger: ILogger;
  appConfig: () => IAppConfigurationService;
}

class IntegrationsService
  extends StandardService<IntegrationId, Integration>
  implements IIntegrationsService
{
  constructor(
    ctx: IntegrationsServiceContext,
    dependencies = {
      createIntegrationsRepo,
      createIntegrationsCache,
    },
  ) {
    const appConfig = ctx.appConfig();

    super('integrations', {
      ...ctx,
      repo: () => dependencies.createIntegrationsRepo(appConfig),
      cache: () =>
        dependencies.createIntegrationsCache({
          logger: ctx.logger,
          appConfig,
        }),
      newId: IntegrationId,
    });
  }
}
