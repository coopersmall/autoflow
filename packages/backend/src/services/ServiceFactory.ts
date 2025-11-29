import type { ILogger } from '@backend/logger/Logger';
import { createAIService, type IAIService } from './ai/AIService';
import {
  createUserAuthenticationService,
  type IUserAuthenticationService,
} from './auth/UserAuthenticationService';
import {
  createAppConfigurationService,
  type IAppConfigurationService,
} from './configuration/AppConfigurationService';
import { createRSAEncryptionService } from './encryption/RSAEncryptionService';
import {
  createIntegrationsService,
  type IIntegrationsService,
} from './integrations/IntegrationsService';
import { createJWTService, type IJWTService } from './jwt/JWTService';
import {
  createSecretsService,
  type ISecretsService,
} from './secrets/SecretsService';
import { createUsersService, type IUsersService } from './users/UsersService';

export interface IServiceFactory {
  getService<T extends ServiceName>(serviceName: T): ServiceConstructor<T>;
}

export function createServiceFactory({
  logger,
}: {
  logger: ILogger;
}): IServiceFactory {
  return new ServiceFactory(logger);
}

class ServiceFactory implements IServiceFactory {
  private readonly constructors: IServices;
  constructor(logger: ILogger) {
    this.constructors = createServices({
      logger,
      serviceFactory: () => this,
    });
  }

  getService<T extends ServiceName>(serviceName: T): ServiceConstructor<T> {
    return this.constructors[serviceName];
  }
}

interface IServices {
  ai: () => IAIService;
  appConfig: () => IAppConfigurationService;
  integrations: () => IIntegrationsService;
  jwt: () => IJWTService;
  secrets: () => ISecretsService;
  userAuth: () => IUserAuthenticationService;
  users: () => IUsersService;
}

export type ServiceName = keyof IServices;
type ServiceConstructor<T extends ServiceName> = IServices[T];

function createServices({
  logger,
}: {
  logger: ILogger;
  serviceFactory: () => IServiceFactory;
}): IServices {
  const appConfig = () => {
    return createAppConfigurationService();
  };

  const ai = () => {
    return createAIService({
      appConfig,
    });
  };

  const integrations = () => {
    return createIntegrationsService({
      logger,
      appConfig,
    });
  };

  const encryptionService = () => {
    return createRSAEncryptionService({ logger });
  };

  const secrets = () => {
    return createSecretsService({
      logger,
      appConfig,
      encryptionService,
    });
  };

  const jwt = () => {
    return createJWTService({
      logger,
    });
  };

  const userAuth = () => {
    return createUserAuthenticationService({
      logger,
      jwt,
    });
  };

  const users = () => {
    return createUsersService({
      logger,
      appConfig,
    });
  };

  return {
    ai,
    appConfig,
    integrations,
    jwt,
    secrets,
    userAuth,
    users,
  };
}
