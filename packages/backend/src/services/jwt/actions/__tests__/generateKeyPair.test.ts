import { describe, expect, it } from 'bun:test';
import { getMockedLogger } from '@backend/logger/__mocks__/Logger.mock';
import { generateKeyPair } from '@backend/services/jwt/actions/generateKeyPair';

describe('generateKeyPair', () => {
  it('should generate RSA key pair successfully', async () => {
    const logger = getMockedLogger();

    const result = await generateKeyPair({ logger }, {});

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.privateKey).toContain('BEGIN PRIVATE KEY');
      expect(result.value.publicKey).toContain('BEGIN PUBLIC KEY');
    }
  });
});
