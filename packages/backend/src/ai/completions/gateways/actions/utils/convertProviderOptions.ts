import type { JSONValue } from 'ai';
import type { CompletionsProvider } from '../../../providers/CompletionsProviders';

export function convertProviderOptions(
  provider: CompletionsProvider,
): Record<string, Record<string, JSONValue>> | undefined {
  if (!provider.options) {
    return;
  }
  return {
    [provider.provider]: provider.options,
  };
}
