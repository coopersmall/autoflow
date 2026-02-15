export interface RedactPiiContext {
  readonly logger?: {
    debug(message: string, data?: Record<string, unknown>): void;
  };
}

const EMAIL_PATTERN =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const PHONE_PATTERN =
  /(?<!\d)(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}(?!\d)/g;

const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;

const CREDIT_CARD_PATTERN = /\b(?:\d[ -]*?){13,19}\b/g;

function passesLuhn(digits: string): boolean {
  const nums = digits.replace(/\D/g, '');
  if (nums.length < 13 || nums.length > 19) {
    return false;
  }

  let sum = 0;
  let alternate = false;

  for (let i = nums.length - 1; i >= 0; i--) {
    let n = Number.parseInt(nums[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) {
        n -= 9;
      }
    }
    sum += n;
    alternate = !alternate;
  }

  return sum % 10 === 0;
}

export function redactPii(text: string, ctx?: RedactPiiContext): string {
  let redacted = text;
  let count = 0;

  redacted = redacted.replace(SSN_PATTERN, () => {
    count++;
    return '[REDACTED]';
  });

  redacted = redacted.replace(CREDIT_CARD_PATTERN, (match) => {
    const digits = match.replace(/\D/g, '');
    if (passesLuhn(digits)) {
      count++;
      return '[REDACTED]';
    }
    return match;
  });

  redacted = redacted.replace(EMAIL_PATTERN, () => {
    count++;
    return '[REDACTED]';
  });

  redacted = redacted.replace(PHONE_PATTERN, () => {
    count++;
    return '[REDACTED]';
  });

  if (count > 0 && ctx?.logger) {
    ctx.logger.debug('Redacted PII from text', { redactionCount: count });
  }

  return redacted;
}
