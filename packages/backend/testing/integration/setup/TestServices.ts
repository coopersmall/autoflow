export class TestServices {
  static getDatabaseUrl(): string {
    return 'postgres://test:test@localhost:5433/testdb';
  }

  static getRedisUrl(): string {
    return 'redis://localhost:6380';
  }
}
