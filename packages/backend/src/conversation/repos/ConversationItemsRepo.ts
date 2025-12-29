import {
  type IAppConfigurationService,
  StandardRepo,
} from '@backend/infrastructure';
import type { Context } from '@backend/infrastructure/context';
import { convertQueryResultsToData } from '@backend/infrastructure/repos/actions/convertQueryResultsToData';
import { validateRawDatabaseQuery } from '@backend/infrastructure/repos/domain/RawDatabaseQuery';
import { createDatabaseError } from '@backend/infrastructure/repos/errors/DBError';
import type { ConversationId } from '@core/domain/conversation';
import {
  type ConversationItem,
  type ConversationItemId,
  validConversationItem,
} from '@core/domain/conversation';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import type { ExtractMethods } from '@core/types';
import { validate } from '@core/validation/validate';
import { err, ok, type Result } from 'neverthrow';
import { z as zod } from 'zod';

const maxTurnIndexResultSchema = zod.array(
  zod.object({
    max_turn_index: zod.number(),
  }),
);

export type IConversationItemsRepo = Readonly<
  ExtractMethods<ConversationItemsRepo>
>;

export function createConversationItemsRepo(config: {
  appConfig: IAppConfigurationService;
}): IConversationItemsRepo {
  return Object.freeze(new ConversationItemsRepo(config));
}

const CONVERSATION_ITEMS_TABLE = 'conversation_items';

class ConversationItemsRepo extends StandardRepo<
  ConversationItemId,
  ConversationItem
> {
  constructor(config: { appConfig: IAppConfigurationService }) {
    super(CONVERSATION_ITEMS_TABLE, config.appConfig, validConversationItem, {
      extraColumns: {
        columnToField: {
          conversation_id: 'conversationId',
        },
      },
    });
  }

  /**
   * Gets the latest (highest) turn index for a conversation.
   * Returns -1 if no items exist (so next turn index would be 0).
   * @param ctx - Request context for tracing and cancellation
   * @param conversationId - ID of the conversation
   * @param userId - ID of the user who owns the conversation
   * @returns The latest turn index, or -1 if no items exist
   */
  async getLatestTurnIndex(
    _ctx: Context,
    conversationId: ConversationId,
    userId: UserId,
  ): Promise<Result<number, AppError>> {
    const clientResult = this.getClient(userId);
    if (clientResult.isErr()) {
      return err(clientResult.error);
    }

    const db = clientResult.value;

    try {
      // turnIndex is stored in the data JSONB column
      const rawResult = await db`
        SELECT COALESCE(MAX((data->>'turnIndex')::int), -1) as max_turn_index
        FROM ${db(CONVERSATION_ITEMS_TABLE)}
        WHERE user_id = ${userId}
        AND conversation_id = ${conversationId}
      `;

      // Validate the result structure
      const validationResult = validate(maxTurnIndexResultSchema, rawResult);
      if (validationResult.isErr()) {
        return err(validationResult.error);
      }

      const rows = validationResult.value;
      // This is a scalar query with COALESCE - always returns exactly one row
      if (rows.length === 0) {
        return ok(-1);
      }

      return ok(rows[0].max_turn_index);
    } catch (error) {
      return err(createDatabaseError(error));
    }
  }

  /**
   * Gets all conversation items for a specific conversation, sorted by turnIndex.
   * @param ctx - Request context for tracing and cancellation
   * @param conversationId - ID of the conversation
   * @param userId - ID of the user who owns the conversation
   * @returns Array of conversation items sorted by turnIndex, or error
   */
  async getByConversationId(
    _ctx: Context,
    conversationId: ConversationId,
    userId: UserId,
  ): Promise<Result<ConversationItem[], AppError>> {
    const clientResult = this.getClient(userId);
    if (clientResult.isErr()) {
      return err(clientResult.error);
    }

    const db = clientResult.value;

    try {
      const rawResult = await db`
        SELECT * FROM ${db(CONVERSATION_ITEMS_TABLE)}
        WHERE user_id = ${userId}
        AND conversation_id = ${conversationId}
        ORDER BY created_at ASC
      `;

      // Validate the raw database result structure
      const validatedRaw = validateRawDatabaseQuery(rawResult);
      if (validatedRaw.isErr()) {
        return err(validatedRaw.error);
      }

      // Convert raw database results to validated domain entities
      const validatedResult = convertQueryResultsToData(
        validatedRaw.value,
        validConversationItem,
      );

      if (validatedResult.isErr()) {
        return err(validatedResult.error);
      }

      return ok(validatedResult.value);
    } catch (error) {
      return err(createDatabaseError(error));
    }
  }
}
