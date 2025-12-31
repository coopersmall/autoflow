export {
  createDistributedLock,
  type DistributedLockConfig,
  type IDistributedLock,
} from './DistributedLock';
export type {
  ILockAdapter,
  LockClientType,
  LockHandle,
  LockOptions,
} from './domain/Lock';
export {
  isLockNotAcquiredError,
  lockNotAcquiredError,
  lockOperationError,
} from './errors/lockErrors';
