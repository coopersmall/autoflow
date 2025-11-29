export const environments = [
  'local',
  'development',
  'staging',
  'production',
] as const;
export type Environment = (typeof environments)[number];
