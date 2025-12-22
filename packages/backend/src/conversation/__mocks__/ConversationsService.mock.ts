import { mock } from 'bun:test';
import { getMockedStandardService } from '@backend/__mocks__/StandardService.mock';
import type { IConversationsService } from '@backend/conversation/domain/ConversationsService';
import type { Conversation, ConversationId } from '@core/domain/conversation';
import type { ExtractMockMethods } from '@core/types';

export function getMockedConversationsService(): ExtractMockMethods<IConversationsService> {
  return {
    ...getMockedStandardService<ConversationId, Conversation>(),
    getItems: mock(),
    appendItem: mock(),
    getWithItems: mock(),
    close: mock(),
    reopen: mock(),
    updateTitle: mock(),
  };
}
