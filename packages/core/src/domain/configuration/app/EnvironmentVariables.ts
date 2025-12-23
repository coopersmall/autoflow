export const environmentVairables = [
  'POLYGON_KEY',
  'OPENAI_KEY',
  'GCP_CREDENTIALS',
  'GOOGLE_GEN_AI_KEY',
  'NODE_ENV',
  'JWT_PUBLIC_KEY',
  'JWT_PRIVATE_KEY',
  'SECRETS_PUBLIC_KEY',
  'SECRETS_PRIVATE_KEY',
  'DATABASE_URL',
  'REDIS_URL',
  'SITE_URL',
] as const;
export type EnvironmentVariable = (typeof environmentVairables)[number];
