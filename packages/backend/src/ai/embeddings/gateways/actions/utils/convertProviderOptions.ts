import type { JSONValue } from 'ai';
import type { EmbeddingsProvider } from '../../../providers/EmbeddingsProviders.ts';

export function convertProviderOptions(
  provider: EmbeddingsProvider,
): Record<string, Record<string, JSONValue>> | undefined {
  if (!provider.options) {
    return;
  }
  return {
    [provider.provider]: provider.options,
  };
}
