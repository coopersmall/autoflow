import type { IStandardRepo } from '@backend/repos/StandardRepo';
import type { Secret, SecretId } from '@core/domain/secrets/Secret';

export type ISecretsRepo = IStandardRepo<SecretId, Secret>;
