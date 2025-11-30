import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import { StandardRepo } from '@backend/infrastructure/repos/StandardRepo';
import type { IIntegrationsRepo } from '@backend/integrations/domain/IntegrationsRepo';
import type { IntegrationId } from '@core/domain/integrations/BaseIntegration';
import type { Integration } from '@core/domain/integrations/Integration';
import { validIntegration } from '@core/domain/integrations/validation/validIntegration';

export function createIntegrationsRepo(
  appConfig: IAppConfigurationService,
): IIntegrationsRepo {
  return Object.freeze(new IntegrationsRepo(appConfig));
}

class IntegrationsRepo
  extends StandardRepo<IntegrationId, Integration>
  implements IIntegrationsRepo
{
  constructor(appConfig: IAppConfigurationService) {
    super('integrations', appConfig, validIntegration);
  }
}
