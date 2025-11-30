import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import { StandardService } from '@backend/infrastructure/services/StandardService';
import {
  type Integration,
  IntegrationId,
} from '@core/domain/integrations/Integration';
import { createIntegrationsCache } from '../cache/IntegrationsCache.ts';
import type { IIntegrationsService } from '../domain/IntegrationsService.ts';
import { createIntegrationsRepo } from '../repos/IntegrationsRepo.ts';

export { createIntegrationsService };

function createIntegrationsService(
  ctx: IntegrationsServiceContext,
): IIntegrationsService {
  return Object.freeze(new IntegrationsService(ctx));
}

interface IntegrationsServiceContext {
  logger: ILogger;
  appConfig: IAppConfigurationService;
}

interface IntegrationsServiceDependencies {
  createIntegrationsRepo: typeof createIntegrationsRepo;
  createIntegrationsCache: typeof createIntegrationsCache;
}

class IntegrationsService
  extends StandardService<IntegrationId, Integration>
  implements IIntegrationsService
{
  constructor(
    private readonly ctx: IntegrationsServiceContext,
    private readonly dependencies: IntegrationsServiceDependencies = {
      createIntegrationsRepo,
      createIntegrationsCache,
    },
  ) {
    const appConfig = ctx.appConfig;

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
