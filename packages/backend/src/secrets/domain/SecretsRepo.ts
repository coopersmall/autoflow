import type { IStandardRepo } from '@backend/infrastructure/repos/StandardRepo';
import type { Secret, SecretId } from '@core/domain/secrets/Secret';

export type ISecretsRepo = IStandardRepo<SecretId, Secret>;
