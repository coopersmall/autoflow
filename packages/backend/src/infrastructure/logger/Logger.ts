import pino from 'pino';

export interface ILogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, cause: unknown, meta?: Record<string, unknown>): void;
}

class Logger implements ILogger {
  private logger: pino.Logger;
  private baseMetadata: Record<string, unknown>;

  constructor(baseMetadata?: Record<string, unknown>) {
    this.logger = pino();
    this.baseMetadata = baseMetadata || {};
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug({ ...this.baseMetadata, ...meta }, message);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info({ ...this.baseMetadata, ...meta }, message);
  }

  error(message: string, cause: unknown, meta?: Record<string, unknown>): void {
    this.logger.error({ ...this.baseMetadata, err: cause, ...meta }, message);
  }
}

export function getLogger(baseMetadata?: Record<string, unknown>): ILogger {
  return new Logger(baseMetadata);
}
