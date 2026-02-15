import { describe, expect, it, mock } from 'bun:test';
import { redactPii } from '@capture/actions/redactPii';

describe('redactPii', () => {
  describe('email addresses', () => {
    it('should redact a simple email', () => {
      expect(redactPii('Contact me at john@example.com please')).toBe(
        'Contact me at [REDACTED] please',
      );
    });

    it('should redact multiple emails', () => {
      expect(redactPii('From alice@test.org to bob@company.co.uk')).toBe(
        'From [REDACTED] to [REDACTED]',
      );
    });

    it('should redact emails with special characters', () => {
      expect(redactPii('user.name+tag@domain.com')).toBe('[REDACTED]');
    });

    it('should redact emails with dots and dashes', () => {
      expect(redactPii('first.last@sub-domain.example.com')).toBe('[REDACTED]');
    });

    it('should not redact non-email text', () => {
      expect(redactPii('Hello world')).toBe('Hello world');
    });
  });

  describe('phone numbers', () => {
    it('should redact US phone format XXX-XXX-XXXX', () => {
      expect(redactPii('Call 555-123-4567')).toBe('Call [REDACTED]');
    });

    it('should redact phone with dots', () => {
      expect(redactPii('Phone: 555.123.4567')).toBe('Phone: [REDACTED]');
    });

    it('should redact phone with spaces', () => {
      expect(redactPii('Number: 555 123 4567')).toBe('Number: [REDACTED]');
    });

    it('should redact phone with country code', () => {
      expect(redactPii('Call +1-555-123-4567')).toBe('Call [REDACTED]');
    });

    it('should redact phone with parentheses', () => {
      expect(redactPii('Fax: (555) 123-4567')).toBe('Fax: [REDACTED]');
    });
  });

  describe('SSN', () => {
    it('should redact SSN format', () => {
      expect(redactPii('SSN: 123-45-6789')).toBe('SSN: [REDACTED]');
    });

    it('should redact multiple SSNs', () => {
      expect(redactPii('A: 123-45-6789, B: 987-65-4321')).toBe(
        'A: [REDACTED], B: [REDACTED]',
      );
    });

    it('should not redact non-SSN dash patterns', () => {
      expect(redactPii('Reference: 12-345-67890')).toBe(
        'Reference: 12-345-67890',
      );
    });
  });

  describe('credit cards', () => {
    it('should redact a valid Visa card number', () => {
      // 4111111111111111 passes Luhn
      expect(redactPii('Card: 4111111111111111')).toBe('Card: [REDACTED]');
    });

    it('should redact a valid card with spaces', () => {
      expect(redactPii('Card: 4111 1111 1111 1111')).toBe('Card: [REDACTED]');
    });

    it('should redact a valid card with dashes', () => {
      expect(redactPii('Card: 4111-1111-1111-1111')).toBe('Card: [REDACTED]');
    });

    it('should not redact numbers that fail Luhn check', () => {
      expect(redactPii('Not a card: 1234567890123456')).toBe(
        'Not a card: 1234567890123456',
      );
    });

    it('should redact a valid Mastercard number', () => {
      // 5500000000000004 passes Luhn
      expect(redactPii('MC: 5500000000000004')).toBe('MC: [REDACTED]');
    });
  });

  describe('mixed PII', () => {
    it('should redact multiple types of PII in one string', () => {
      const input =
        'Email: john@test.com, Phone: 555-123-4567, SSN: 123-45-6789';
      const result = redactPii(input);
      expect(result).toBe(
        'Email: [REDACTED], Phone: [REDACTED], SSN: [REDACTED]',
      );
    });

    it('should return empty string for empty input', () => {
      expect(redactPii('')).toBe('');
    });

    it('should handle text with no PII', () => {
      const text = 'This is a normal message about the weather.';
      expect(redactPii(text)).toBe(text);
    });
  });

  describe('context logger', () => {
    it('should log when PII is redacted and logger is provided', () => {
      const debugFn = mock();
      const ctx = { logger: { debug: debugFn } };

      redactPii('email: test@example.com', ctx);

      expect(debugFn).toHaveBeenCalledWith('Redacted PII from text', {
        redactionCount: 1,
      });
    });

    it('should not log when no PII is found', () => {
      const debugFn = mock();
      const ctx = { logger: { debug: debugFn } };

      redactPii('no pii here', ctx);

      expect(debugFn).not.toHaveBeenCalled();
    });

    it('should work without context', () => {
      expect(() => redactPii('test@example.com')).not.toThrow();
    });
  });
});
