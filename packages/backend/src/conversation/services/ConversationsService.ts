import { appendItem } from '@backend/conversation/actions/appendItem';
import { closeConversation } from '@backend/conversation/actions/closeConversation';
import { getItems } from '@backend/conversation/actions/getItems';
import { getNextTurnIndex } from '@backend/conversation/actions/getNextTurnIndex';
import { getWithItems } from '@backend/conversation/actions/getWithItems';
import { reopenConversation } from '@backend/conversation/actions/reopenConversation';
import { updateTitle } from '@backend/conversation/actions/updateTitle';
import { createConversationsCache } from '@backend/conversation/cache/ConversationsCache';
import type { AppendItemData } from '@backend/conversation/domain/AppendItemData';
import type { IConversationsService } from '@backend/conversation/domain/ConversationsService';
import type { ConversationWithItems } from '@backend/conversation/domain/ConversationWithItems';
import {
  createConversationItemsRepo,
  type IConversationItemsRepo,
} from '@backend/conversation/repos/ConversationItemsRepo';
import { createConversationsRepo } from '@backend/conversation/repos/ConversationsRepo';
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { Context } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import { StandardService } from '@backend/infrastructure/services/StandardService';
import {
  type Conversation,
  ConversationId,
  type ConversationItem,
  ConversationItemId,
} from '@core/domain/conversation';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

export function createConversationsService(
  config: ConversationsServiceConfig,
): IConversationsService {
  return Object.freeze(new ConversationsService(config));
}

interface ConversationsServiceConfig {
  readonly logger: ILogger;
  readonly appConfig: IAppConfigurationService;
}

interface ConversationsServiceActions {
  readonly getItems: typeof getItems;
  readonly appendItem: typeof appendItem;
  readonly getWithItems: typeof getWithItems;
  readonly closeConversation: typeof closeConversation;
  readonly reopenConversation: typeof reopenConversation;
  readonly updateTitle: typeof updateTitle;
  readonly getNextTurnIndex: typeof getNextTurnIndex;
}

interface ConversationsServiceDependencies {
  readonly createConversationsRepo: typeof createConversationsRepo;
  readonly createConversationsCache: typeof createConversationsCache;
  readonly createConversationItemsRepo: typeof createConversationItemsRepo;
}

/**
 * Service for managing conversations and their items.
 * Extends StandardService to provide CRUD operations on Conversation entities
 * and provides additional methods for managing ConversationItem entities.
 */
class ConversationsService
  extends StandardService<ConversationId, Conversation>
  implements IConversationsService
{
  private readonly itemsRepo: IConversationItemsRepo;

  constructor(
    private readonly conversationsConfig: ConversationsServiceConfig,
    private readonly actions: ConversationsServiceActions = {
      getItems,
      appendItem,
      getWithItems,
      closeConversation,
      reopenConversation,
      updateTitle,
      getNextTurnIndex,
    },
    dependencies: ConversationsServiceDependencies = {
      createConversationsRepo,
      createConversationsCache,
      createConversationItemsRepo,
    },
  ) {
    const { logger, appConfig } = conversationsConfig;

    super('conversations', {
      logger,
      repo: () => dependencies.createConversationsRepo({ appConfig }),
      cache: () =>
        dependencies.createConversationsCache({
          logger,
          appConfig,
        }),
      newId: ConversationId,
    });

    this.itemsRepo = dependencies.createConversationItemsRepo({ appConfig });
  }

  /**
   * Gets all items for a conversation, sorted by turnIndex.
   */
  async getItems(
    ctx: Context,
    conversationId: ConversationId,
    userId: UserId,
  ): Promise<Result<ConversationItem[], AppError>> {
    return this.actions.getItems(
      ctx,
      { conversationId, userId },
      { itemsRepo: this.itemsRepo },
    );
  }

  /**
   * Appends a new item to a conversation.
   */
  async appendItem(
    ctx: Context,
    conversationId: ConversationId,
    userId: UserId,
    item: AppendItemData,
  ): Promise<Result<ConversationItem, AppError>> {
    return this.actions.appendItem(
      ctx,
      { conversationId, userId, item },
      { itemsRepo: this.itemsRepo, newId: ConversationItemId },
    );
  }

  /**
   * Gets a conversation with all its items.
   */
  async getWithItems(
    ctx: Context,
    conversationId: ConversationId,
    userId: UserId,
  ): Promise<Result<ConversationWithItems, AppError>> {
    return this.actions.getWithItems(
      ctx,
      { conversationId, userId },
      { conversations: this, itemsRepo: this.itemsRepo },
    );
  }

  /**
   * Closes a conversation by setting its status to 'closed'.
   */
  async close(
    ctx: Context,
    conversationId: ConversationId,
    userId: UserId,
  ): Promise<Result<Conversation, AppError>> {
    return this.actions.closeConversation(
      ctx,
      { conversationId, userId },
      { conversations: this },
    );
  }

  /**
   * Reopens a conversation by setting its status to 'reopened'.
   */
  async reopen(
    ctx: Context,
    conversationId: ConversationId,
    userId: UserId,
  ): Promise<Result<Conversation, AppError>> {
    return this.actions.reopenConversation(
      ctx,
      { conversationId, userId },
      { conversations: this },
    );
  }

  /**
   * Updates the title of a conversation.
   */
  async updateTitle(
    ctx: Context,
    conversationId: ConversationId,
    userId: UserId,
    title: string,
  ): Promise<Result<Conversation, AppError>> {
    return this.actions.updateTitle(
      ctx,
      { conversationId, userId, title },
      { conversations: this },
    );
  }

  /**
   * Gets the next turn index for a conversation.
   * This is the latest turn index + 1, or 0 if no items exist.
   */
  async getNextTurnIndex(
    ctx: Context,
    conversationId: ConversationId,
    userId: UserId,
  ): Promise<Result<number, AppError>> {
    return this.actions.getNextTurnIndex(
      ctx,
      { conversationId, userId },
      { itemsRepo: this.itemsRepo },
    );
  }
}
