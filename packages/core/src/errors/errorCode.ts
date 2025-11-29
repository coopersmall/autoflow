export const errorCodes = [
  'BadRequest',
  'Unauthorized',
  'Forbidden',
  'NotFound',
  'InternalServer',
  'Timeout',
  'GatewayTimeout',
  'TooManyRequests',
  'Unauthorized',
] as const;

export type ErrorCode = (typeof errorCodes)[number];
