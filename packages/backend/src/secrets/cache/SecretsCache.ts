import { StandardCache } from '@backend/infrastructure/cache/StandardCache';
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { ISecretsCache } from '@backend/secrets/domain/SecretsCache';
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
