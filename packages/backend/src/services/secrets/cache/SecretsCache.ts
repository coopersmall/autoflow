import { StandardCache } from '@backend/cache/StandardCache';
import type { ILogger } from '@backend/logger/Logger';
import type { IAppConfigurationService } from '@backend/services/configuration/AppConfigurationService';
import type { ISecretsCache } from '@backend/services/secrets/domain/SecretsCache';
import type { Secret, SecretId } from '@core/domain/secrets/Secret';
import { validSecret } from '@core/domain/secrets/validation/validSecret';

export function createSecretsCache(options: {
  logger: ILogger;
  appConfig: IAppConfigurationService;
  ttlSeconds?: number;
}): ISecretsCache {
  return new SecretsCache('secrets', {
    logger: options.logger,
    appConfig: options.appConfig,
    ttlSeconds: options.ttlSeconds,
  });
}

class SecretsCache
  extends StandardCache<SecretId, Secret>
  implements ISecretsCache
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
      validator: validSecret,
    });
  }
}
