import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  type PgColumnBuilderBase,
  type PgTableExtraConfigValue,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// SHARED TABLES

export const users = createSharedTable('users');
export const tasks = createSharedTable('tasks', {}, [
  index('tasks_user_id_idx').on(sql`((data->>'userId'))`),
  index('tasks_status_idx').on(sql`((data->>'status'))`),
  index('tasks_task_name_idx').on(sql`((data->>'taskName'))`),
]);

// STANDARD TABLES

export const integrations = createStandardTable('integrations');
export const secrets = createStandardTable('secrets');
export const conversations = createStandardTable('conversations');
export const conversationItems = createStandardTable(
  'conversation_items',
  {
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, {
        onDelete: 'cascade',
      }),
  },
  [index('conversation_items_conversation_id_idx').on(sql`conversation_id`)],
);

// TABLE FACTORY FUNCTIONS

type Columns = Record<string, PgColumnBuilderBase>;
type Extension = PgTableExtraConfigValue;

function createSharedTable(
  tableName: string,
  columns?: Columns,
  extensions?: Extension[],
) {
  return pgTable(
    tableName,
    {
      ...columns,
      id: text('id').primaryKey(),
      data: jsonb('data').notNull().default({}),
      createdAt: timestamp('created_at').notNull().defaultNow(),
      updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (_) => [...(extensions ?? [])],
  );
}

function createStandardTable(
  tableName: string,
  columns?: Columns,
  extensions?: Extension[],
) {
  return createSharedTable(
    tableName,
    {
      ...columns,
      userId: text('user_id')
        .notNull()
        .references(() => users.id, {
          onDelete: 'cascade',
        }),
    },
    extensions,
  );
}
