import { beforeEach, describe, expect, it, jest, mock } from 'bun:test';
import { generateSalt } from '@backend/services/encryption/actions/generateSalt';

describe('generateSalt', () => {
  const mockRandomBytes = mock();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate salt with default length (32 bytes)', () => {
    const mockBytes = Buffer.alloc(32, 0x12); // 32 bytes filled with 0x12
    mockRandomBytes.mockReturnValueOnce(mockBytes);

    const result = generateSalt({}, { randomBytes: mockRandomBytes });

    expect(mockRandomBytes).toHaveBeenCalledWith(32);
    expect(result).toBe('12'.repeat(32)); // 32 bytes = 64 hex characters
    expect(result).toHaveLength(64); // 32 bytes = 64 hex characters
  });

  it('should generate salt with custom length', () => {
    const customLength = 16;
    const mockBytes = Buffer.alloc(16, 0x34); // 16 bytes filled with 0x34
    mockRandomBytes.mockReturnValueOnce(mockBytes);

    const result = generateSalt(
      { length: customLength },
      { randomBytes: mockRandomBytes },
    );

    expect(mockRandomBytes).toHaveBeenCalledWith(customLength);
    expect(result).toBe('34'.repeat(16)); // 16 bytes = 32 hex characters
    expect(result).toHaveLength(32); // 16 bytes = 32 hex characters
  });

  it('should generate salt with various custom lengths', () => {
    const testCases = [
      { length: 8, expectedHexLength: 16 },
      { length: 16, expectedHexLength: 32 },
      { length: 64, expectedHexLength: 128 },
    ];

    testCases.forEach(({ length, expectedHexLength }) => {
      const mockBytes = Buffer.alloc(length, 0xff); // All bytes set to 0xff for consistent hex output
      mockRandomBytes.mockReturnValueOnce(mockBytes);

      const result = generateSalt({ length }, { randomBytes: mockRandomBytes });

      expect(mockRandomBytes).toHaveBeenCalledWith(length);
      expect(result).toHaveLength(expectedHexLength);
      expect(result).toMatch(/^[0-9a-f]+$/); // Verify hex format
    });
  });

  it('should handle empty length parameter (use default)', () => {
    const mockBytes = Buffer.alloc(32, 0x56); // 32 bytes filled with 0x56
    mockRandomBytes.mockReturnValueOnce(mockBytes);

    const result = generateSalt(undefined, { randomBytes: mockRandomBytes });

    expect(mockRandomBytes).toHaveBeenCalledWith(32);
    expect(result).toHaveLength(64);
  });

  it('should convert buffer to hex string correctly', () => {
    // Test with known byte values
    const testBytes = Buffer.from([
      0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
    ]);
    mockRandomBytes.mockReturnValueOnce(testBytes);

    const result = generateSalt(
      { length: 8 },
      { randomBytes: mockRandomBytes },
    );

    expect(mockRandomBytes).toHaveBeenCalledWith(8);
    expect(result).toBe('0123456789abcdef');
    expect(result).toHaveLength(16);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it('should handle zero length', () => {
    const mockBytes = Buffer.alloc(0);
    mockRandomBytes.mockReturnValueOnce(mockBytes);

    const result = generateSalt(
      { length: 0 },
      { randomBytes: mockRandomBytes },
    );

    expect(mockRandomBytes).toHaveBeenCalledWith(0);
    expect(result).toBe('');
  });

  it('should produce different results for subsequent calls', () => {
    const mockBytes1 = Buffer.alloc(8, 0x11); // 8 bytes filled with 0x11
    const mockBytes2 = Buffer.alloc(8, 0x22); // 8 bytes filled with 0x22

    mockRandomBytes
      .mockReturnValueOnce(mockBytes1)
      .mockReturnValueOnce(mockBytes2);

    const result1 = generateSalt(
      { length: 8 },
      { randomBytes: mockRandomBytes },
    );
    const result2 = generateSalt(
      { length: 8 },
      { randomBytes: mockRandomBytes },
    );

    expect(result1).toBe('11'.repeat(8)); // 8 bytes = 16 hex characters
    expect(result2).toBe('22'.repeat(8)); // 8 bytes = 16 hex characters
    expect(result1).not.toBe(result2);
  });
});
