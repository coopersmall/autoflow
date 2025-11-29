import type { CorrelationId } from '@core/domain/CorrelationId';
import type { StoredSecret } from '@core/domain/secrets/Secret';
import type { UserId } from '@core/domain/user/user';

export interface StoreSecretRequest {
  correlationId: CorrelationId;
  userId: UserId;
  value: string;
  data: Omit<
    StoredSecret,
    'id' | 'createdAt' | 'updatedAt' | 'encryptedValue' | 'salt'
  >;
}
