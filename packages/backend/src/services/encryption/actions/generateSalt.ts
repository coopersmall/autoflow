import { randomBytes } from 'node:crypto';

export interface GenerateSaltRequest {
  length?: number;
}

export function generateSalt(
  { length = 32 }: GenerateSaltRequest = {},
  actions = { randomBytes },
): string {
  return actions.randomBytes(length).toString('hex');
}
