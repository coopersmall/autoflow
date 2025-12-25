import type { Message } from '../../messages';

export interface ExecuteFunctionOptions {
  messages: Message[];
}

export type ExecuteFunction = (
  input: unknown,
  options: ExecuteFunctionOptions,
) => Promise<unknown>;
