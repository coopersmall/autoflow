import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import { StandardRepo } from '@backend/infrastructure/repos/StandardRepo';
import type { ISecretsRepo } from '@backend/secrets/domain/SecretsRepo';
import type { Secret, SecretId } from '@core/domain/secrets/Secret';
import { validSecret } from '@core/domain/secrets/validation/validSecret';

export function createSecretsRepo({
  appConfig,
}: {
  appConfig: IAppConfigurationService;
}): ISecretsRepo {
  return new SecretsRepo(appConfig);
}

class SecretsRepo
  extends StandardRepo<SecretId, Secret>
  implements ISecretsRepo
{
  constructor(appConfig: IAppConfigurationService) {
    super(appConfig, 'secrets', validSecret);
  }
}
