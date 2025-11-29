import { StandardRepo } from '@backend/repos/StandardRepo';
import type { IAppConfigurationService } from '@backend/services/configuration/AppConfigurationService';
import type { IIntegrationsRepo } from '@backend/services/integrations/domain/IntegrationsRepo';
import type { IntegrationId } from '@core/domain/integrations/BaseIntegration';
import type { Integration } from '@core/domain/integrations/Integration';
import { validIntegration } from '@core/domain/integrations/validation/validIntegration';

export function createIntegrationsRepo(
  appConfig: IAppConfigurationService,
): IIntegrationsRepo {
  return new IntegrationsRepo(appConfig);
}

class IntegrationsRepo
  extends StandardRepo<IntegrationId, Integration>
  implements IIntegrationsRepo
{
  constructor(appConfig: IAppConfigurationService) {
    super(appConfig, 'integrations', validIntegration);
  }
}
