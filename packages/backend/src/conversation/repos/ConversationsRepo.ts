import {
  type IAppConfigurationService,
  StandardRepo,
} from '@backend/infrastructure';
import {
  type Conversation,
  type ConversationId,
  validConversation,
} from '@core/domain/conversation';
import type { ExtractMethods } from '@core/types';

export type IConversationsRepo = Readonly<ExtractMethods<ConversationsRepo>>;

export function createConversationsRepo(config: {
  appConfig: IAppConfigurationService;
}): IConversationsRepo {
  return Object.freeze(new ConversationsRepo(config));
}

class ConversationsRepo extends StandardRepo<ConversationId, Conversation> {
  constructor(
    private readonly config: {
      appConfig: IAppConfigurationService;
    },
  ) {
    super('conversations', config.appConfig, validConversation);
  }
}
