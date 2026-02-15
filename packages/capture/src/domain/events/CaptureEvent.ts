import zod from 'zod';
import { domChangeEventSchema } from './DomChangeEvent';
import { networkRequestEventSchema } from './NetworkRequestEvent';
import { userActionEventSchema } from './UserActionEvent';

export const captureEventSchema = zod.discriminatedUnion('type', [
  domChangeEventSchema,
  networkRequestEventSchema,
  userActionEventSchema,
]);
export type CaptureEvent = zod.infer<typeof captureEventSchema>;
