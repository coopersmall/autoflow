import type { CorrelationId } from '@core/domain/CorrelationId';
import type { SecretId } from '@core/domain/secrets/Secret';
import type { UserId } from '@core/domain/user/user';

export interface RevealSecretRequest {
  correlationId: CorrelationId;
  userId: UserId;
  id: SecretId;
}
