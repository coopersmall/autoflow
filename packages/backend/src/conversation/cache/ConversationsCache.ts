import {
  type IAppConfigurationService,
  type ILogger,
  StandardCache,
} from '@backend/infrastructure';
import {
  type Conversation,
  type ConversationId,
  validConversation,
} from '@core/domain/conversation';
import type { ExtractMethods } from '@core/types';

export type IConversationsCache = Readonly<ExtractMethods<ConversationsCache>>;

export function createConversationsCache(config: {
  logger: ILogger;
  appConfig: IAppConfigurationService;
}): IConversationsCache {
  return Object.freeze(new ConversationsCache(config));
}

class ConversationsCache extends StandardCache<ConversationId, Conversation> {
  constructor(
    private readonly config: {
      logger: ILogger;
      appConfig: IAppConfigurationService;
    },
  ) {
    super('conversations', {
      appConfig: config.appConfig,
      logger: config.logger,
      validator: validConversation,
    });
  }
}
