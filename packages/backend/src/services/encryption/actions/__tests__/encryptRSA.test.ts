import { beforeEach, describe, expect, it, jest, mock } from 'bun:test';
import { getMockedLogger } from '@backend/logger/__mocks__/Logger.mock';
import { encryptRSA } from '@backend/services/encryption/actions/encryptRSA';
import { CorrelationId } from '@core/domain/CorrelationId';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';

describe('encryptRSA', () => {
  const correlationId = CorrelationId('test-correlation-id');
  const plainData = Buffer.from('secret-data-to-encrypt', 'utf8');
  const publicKey = Buffer.from(
    '-----BEGIN PUBLIC KEY-----\nMOCK_PUBLIC_KEY\n-----END PUBLIC KEY-----',
    'utf8',
  );
  const encryptedData = Buffer.from('encrypted-result', 'utf8');

  const request = {
    correlationId,
    data: plainData,
    publicKey,
  };

  const mockLogger = getMockedLogger();
  const mockPublicEncrypt = mock();

  const ctx = {
    logger: mockLogger,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should encrypt data successfully', async () => {
    mockPublicEncrypt.mockReturnValueOnce(encryptedData);

    const result = await encryptRSA(ctx, request, {
      publicEncrypt: mockPublicEncrypt,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual(encryptedData);
    }
  });

  it('should verify publicEncrypt is called with correct parameters', async () => {
    mockPublicEncrypt.mockReturnValueOnce(encryptedData);

    const result = await encryptRSA(ctx, request, {
      publicEncrypt: mockPublicEncrypt,
    });

    expect(result.isOk()).toBe(true);
    expect(mockPublicEncrypt).toHaveBeenCalledWith(
      {
        key: publicKey,
        padding: expect.any(Number), // RSA_PKCS1_PADDING constant
      },
      plainData,
    );
  });

  it('should return error and log when encryption fails', async () => {
    const cryptoError = new Error('Invalid public key');
    mockPublicEncrypt.mockImplementationOnce(() => {
      throw cryptoError;
    });

    const result = await encryptRSA(ctx, request, {
      publicEncrypt: mockPublicEncrypt,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('Encryption error');
      expect(result.error.code).toBe('InternalServer');
      expect(result.error.metadata).toEqual({
        correlationId,
        cause: cryptoError,
      });
    }
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to encrypt data',
      expect.any(ErrorWithMetadata),
      { correlationId },
    );
  });

  it('should handle malformed public key error', async () => {
    const malformedKeyError = new Error(
      'error:0909006C:PEM routines:get_name:no start line',
    );
    mockPublicEncrypt.mockImplementationOnce(() => {
      throw malformedKeyError;
    });

    const result = await encryptRSA(ctx, request, {
      publicEncrypt: mockPublicEncrypt,
    });

    expect(result.isErr()).toBe(true);
    expect(mockPublicEncrypt).toHaveBeenCalledWith(
      {
        key: publicKey,
        padding: expect.any(Number),
      },
      plainData,
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to encrypt data',
      expect.any(ErrorWithMetadata),
      { correlationId },
    );
  });

  it('should handle data too large error', async () => {
    const dataTooLargeError = new Error(
      'error:0407A094:rsa routines:RSA_padding_add_PKCS1_type_2:data too large for key size',
    );
    mockPublicEncrypt.mockImplementationOnce(() => {
      throw dataTooLargeError;
    });

    const result = await encryptRSA(ctx, request, {
      publicEncrypt: mockPublicEncrypt,
    });

    expect(result.isErr()).toBe(true);
    expect(mockPublicEncrypt).toHaveBeenCalledWith(
      {
        key: publicKey,
        padding: expect.any(Number),
      },
      plainData,
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to encrypt data',
      expect.any(ErrorWithMetadata),
      { correlationId },
    );
  });

  it('should handle key size mismatch error', async () => {
    const keySizeError = new Error(
      'error:04075070:rsa routines:RSA_sign:digest too big for rsa key',
    );
    mockPublicEncrypt.mockImplementationOnce(() => {
      throw keySizeError;
    });

    const result = await encryptRSA(ctx, request, {
      publicEncrypt: mockPublicEncrypt,
    });

    expect(result.isErr()).toBe(true);
    expect(mockPublicEncrypt).toHaveBeenCalledWith(
      {
        key: publicKey,
        padding: expect.any(Number),
      },
      plainData,
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to encrypt data',
      expect.any(ErrorWithMetadata),
      { correlationId },
    );
  });
});
