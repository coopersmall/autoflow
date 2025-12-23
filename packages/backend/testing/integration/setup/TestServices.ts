import type { ServiceAccountMechanism } from '@backend/infrastructure/gcp/auth/domain/GCPAuthMechanism';

import { createTestServiceAccountCredentials } from './TestCredentials';

export class TestServices {
  static getDatabaseUrl(): string {
    return 'postgres://test:test@localhost:5433/testdb';
  }

  static getRedisUrl(): string {
    return 'redis://localhost:6380';
  }

  static getGCSEmulatorUrl(): string {
    return 'http://localhost:4443';
  }

  /**
   * Returns a test auth mechanism that supports signed URLs.
   *
   * Uses fake service account credentials with a valid RSA key.
   * The GCS emulator does not validate signatures, so the key
   * just needs to be in valid RSA format for the SDK to sign URLs.
   *
   * @returns ServiceAccountMechanism configured for emulator with signing support
   */
  static getGCPAuthMechanism(): ServiceAccountMechanism {
    return {
      type: 'service_account',
      credentials: createTestServiceAccountCredentials('test-project'),
      apiEndpoint: TestServices.getGCSEmulatorUrl(),
    };
  }
}
