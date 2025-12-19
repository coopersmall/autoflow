import type { SecretId } from '@core/domain/secrets/Secret';
import type { UserId } from '@core/domain/user/user';

export interface RevealSecretRequest {
  userId: UserId;
  id: SecretId;
}
