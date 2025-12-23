import {
  type Environment,
  environments,
} from '@core/domain/configuration/app/Environments';
import type { EnvironmentVariable } from '@core/domain/configuration/app/EnvironmentVariables';
import type { ExtractMethods } from '@core/types';

export type IAppConfigurationService = Readonly<
  ExtractMethods<AppConfigurationService>
>;

export function createAppConfigurationService(opts?: {
  overrides?: AppOverrides;
}): IAppConfigurationService {
  return Object.freeze(new AppConfigurationService(opts?.overrides));
}

type AppConfigKey = keyof AppConfigurationService;
type AppOverrides = Partial<Record<AppConfigKey, string>>;

interface AppConfigurationServiceActions {
  getEnv: typeof getEnv;
}

class AppConfigurationService {
  constructor(
    private readonly overrides: AppOverrides = {},
    private readonly actions: AppConfigurationServiceActions = {
      getEnv,
    },
  ) {}

  get polygonKey(): string | undefined {
    return this.getConfig('polygonKey');
  }

  get openAIKey(): string | undefined {
    return this.getConfig('openAIKey');
  }

  get gcpCredentials(): string | undefined {
    return this.getConfig('gcpCredentials');
  }

  get googleGenAIKey(): string | undefined {
    return this.getConfig('googleGenAIKey');
  }

  get nodeEnv(): string | undefined {
    return this.getConfig('nodeEnv');
  }

  get jwtPublicKey(): string | undefined {
    return this.getConfig('jwtPublicKey');
  }

  get jwtPrivateKey(): string | undefined {
    return this.getConfig('jwtPrivateKey');
  }

  get secretsPublicKey(): string | undefined {
    return this.getConfig('secretsPublicKey');
  }

  get secretsPrivateKey(): string | undefined {
    return this.getConfig('secretsPrivateKey');
  }

  get databaseUrl(): string | undefined {
    return this.getConfig('databaseUrl');
  }

  get redisUrl(): string | undefined {
    return this.getConfig('redisUrl');
  }

  get siteUrl(): string | undefined {
    return this.getConfig('siteUrl');
  }

  get environment(): Environment | undefined {
    const configEnv = this.getConfig('environment');
    if (configEnv) {
      return environments.find((environment) => configEnv === environment);
    }

    const env = this.nodeEnv;
    if (!env) return undefined;
    return environments.find((environment) => env === environment);
  }

  get site(): string {
    return this.getConfig('site') || 'http://localhost:3000';
  }

  isLocal(): boolean {
    return this.environment === 'local';
  }

  private getConfig(key: AppConfigKey): string | undefined {
    if (this.overrides[key]) {
      return this.overrides[key];
    }
    const envKey = appKeyToEnvMap[key];
    return this.actions.getEnv(envKey);
  }
}

function getEnv(key: EnvironmentVariable): string | undefined {
  // biome-ignore lint: This is the intentional single access point for environment variables
  return process.env[key];
}

const appKeyToEnvMap: Record<AppConfigKey, EnvironmentVariable> = {
  polygonKey: 'POLYGON_KEY',
  openAIKey: 'OPENAI_KEY',
  gcpCredentials: 'GCP_CREDENTIALS',
  googleGenAIKey: 'GOOGLE_GEN_AI_KEY',
  nodeEnv: 'NODE_ENV',
  jwtPublicKey: 'JWT_PUBLIC_KEY',
  jwtPrivateKey: 'JWT_PRIVATE_KEY',
  secretsPublicKey: 'SECRETS_PUBLIC_KEY',
  secretsPrivateKey: 'SECRETS_PRIVATE_KEY',
  databaseUrl: 'DATABASE_URL',
  redisUrl: 'REDIS_URL',
  siteUrl: 'SITE_URL',
  environment: 'NODE_ENV',
  site: 'SITE_URL',
  isLocal: 'NODE_ENV',
};
