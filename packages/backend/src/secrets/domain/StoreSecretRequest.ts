import type { StoredSecret } from '@core/domain/secrets/Secret';
import type { UserId } from '@core/domain/user/user';

export interface StoreSecretRequest {
  userId: UserId;
  value: string;
  data: Omit<
    StoredSecret,
    'id' | 'createdAt' | 'updatedAt' | 'encryptedValue' | 'salt'
  >;
}
