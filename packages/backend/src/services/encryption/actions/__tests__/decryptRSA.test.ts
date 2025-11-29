import { beforeEach, describe, expect, it, jest, mock } from 'bun:test';
import { getMockedLogger } from '@backend/logger/__mocks__/Logger.mock';
import { decryptRSA } from '@backend/services/encryption/actions/decryptRSA';
import { CorrelationId } from '@core/domain/CorrelationId';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';

describe('decryptRSA', () => {
  const correlationId = CorrelationId('test-correlation-id');
  const encryptedData = Buffer.from('encrypted-data', 'utf8');
  const privateKey = Buffer.from(
    '-----BEGIN PRIVATE KEY-----\nMOCK_PRIVATE_KEY\n-----END PRIVATE KEY-----',
    'utf8',
  );
  const decryptedData = Buffer.from('decrypted-secret-data', 'utf8');

  const request = {
    correlationId,
    data: encryptedData,
    privateKey,
  };

  const mockLogger = getMockedLogger();
  const mockPrivateDecrypt = mock();

  const ctx = {
    logger: mockLogger,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should decrypt data successfully', async () => {
    mockPrivateDecrypt.mockReturnValueOnce(decryptedData);

    const result = await decryptRSA(ctx, request, {
      privateDecrypt: mockPrivateDecrypt,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual(decryptedData);
    }
  });

  it('should verify privateDecrypt is called with correct parameters', async () => {
    mockPrivateDecrypt.mockReturnValueOnce(decryptedData);

    const result = await decryptRSA(ctx, request, {
      privateDecrypt: mockPrivateDecrypt,
    });

    expect(result.isOk()).toBe(true);
    expect(mockPrivateDecrypt).toHaveBeenCalledWith(
      {
        key: privateKey,
        padding: expect.any(Number), // RSA_PKCS1_PADDING constant
      },
      encryptedData,
    );
  });

  it('should return error and log when decryption fails', async () => {
    const cryptoError = new Error('Invalid private key');
    mockPrivateDecrypt.mockImplementationOnce(() => {
      throw cryptoError;
    });

    const result = await decryptRSA(ctx, request, {
      privateDecrypt: mockPrivateDecrypt,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('Decryption error');
      expect(result.error.code).toBe('InternalServer');
      expect(result.error.metadata).toEqual({
        correlationId,
        cause: cryptoError,
      });
    }
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to decrypt data',
      expect.any(ErrorWithMetadata),
      { correlationId },
    );
  });

  it('should handle malformed private key error', async () => {
    const malformedKeyError = new Error(
      'error:0909006C:PEM routines:get_name:no start line',
    );
    mockPrivateDecrypt.mockImplementationOnce(() => {
      throw malformedKeyError;
    });

    const result = await decryptRSA(ctx, request, {
      privateDecrypt: mockPrivateDecrypt,
    });

    expect(result.isErr()).toBe(true);
    expect(mockPrivateDecrypt).toHaveBeenCalledWith(
      {
        key: privateKey,
        padding: expect.any(Number),
      },
      encryptedData,
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to decrypt data',
      expect.any(ErrorWithMetadata),
      { correlationId },
    );
  });

  it('should handle corrupted encrypted data error', async () => {
    const corruptedDataError = new Error(
      'error:0407106B:rsa routines:RSA_padding_check_PKCS1_type_2:block type is not 02',
    );
    mockPrivateDecrypt.mockImplementationOnce(() => {
      throw corruptedDataError;
    });

    const result = await decryptRSA(ctx, request, {
      privateDecrypt: mockPrivateDecrypt,
    });

    expect(result.isErr()).toBe(true);
    expect(mockPrivateDecrypt).toHaveBeenCalledWith(
      {
        key: privateKey,
        padding: expect.any(Number),
      },
      encryptedData,
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to decrypt data',
      expect.any(ErrorWithMetadata),
      { correlationId },
    );
  });
});
