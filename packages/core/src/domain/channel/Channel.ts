import zod from 'zod';

export type Channel = zod.infer<typeof channelSchema>;
export const channelSchema = zod
  .enum(['chat', 'api'])
  .describe('the communication channel');
