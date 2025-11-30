import type { IStandardCache } from '@backend/infrastructure/cache/StandardCache';
import type { Secret, SecretId } from '@core/domain/secrets/Secret';

export type ISecretsCache = IStandardCache<SecretId, Secret>;
