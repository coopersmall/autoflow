/**
 * Statistics for a BullMQ queue
 */
export interface QueueStats {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}
