import { generateKeyPairSync } from 'node:crypto';
import {
  createAppConfigurationService,
  type IAppConfigurationService,
} from '@backend/infrastructure/configuration/AppConfigurationService';

export interface TestUrls {
  databaseUrl: string;
  redisUrl: string;
}

let cachedJWTKeys: { publicKey: string; privateKey: string };
let cachedSecretsKeys: { publicKey: string; privateKey: string };

export function createTestConfig(urls: TestUrls): IAppConfigurationService {
  const jwtKeys = getOrGenerateJWTKeys();
  const secretsKeys = getOrGenerateSecretsKeys();

  return createAppConfigurationService({
    overrides: {
      databaseUrl: urls.databaseUrl,
      redisUrl: urls.redisUrl,
      environment: 'test',
      nodeEnv: 'test',
      jwtPublicKey: jwtKeys.publicKey,
      jwtPrivateKey: jwtKeys.privateKey,
      secretsPublicKey: secretsKeys.publicKey,
      secretsPrivateKey: secretsKeys.privateKey,
    },
  });
}

function getOrGenerateJWTKeys(): { publicKey: string; privateKey: string } {
  if (!cachedJWTKeys) {
    cachedJWTKeys = generateRSAKeyPair();
  }
  return cachedJWTKeys;
}

function getOrGenerateSecretsKeys(): {
  publicKey: string;
  privateKey: string;
} {
  if (!cachedSecretsKeys) {
    cachedSecretsKeys = generateRSAKeyPair();
  }
  return cachedSecretsKeys;
}

function generateRSAKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  return { publicKey, privateKey };
}
