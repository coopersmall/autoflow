import { sql } from 'drizzle-orm';
import {
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

type Extensions = Parameters<typeof pgTable>[2];

function createSharedTable(tableName: string, extensions?: Extensions) {
  return pgTable(
    tableName,
    {
      id: text('id').primaryKey(),
      data: jsonb('data').notNull().default({}),
      createdAt: timestamp('created_at').notNull().defaultNow(),
      updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => ({
      ...extensions?.(table),
    }),
  );
}

function createStandardTable(tableName: string, extensions?: Extensions) {
  return pgTable(
    tableName,
    {
      id: text('id').primaryKey(),
      data: jsonb('data').notNull().default({}),
      userId: text('user_id')
        .notNull()
        .references(() => users.id),
      createdAt: timestamp('created_at').notNull().defaultNow(),
      updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => ({
      ...extensions?.(table),
    }),
  );
}

export const users = createSharedTable('users');
export const integrations = createStandardTable('integrations');
export const conversations = createStandardTable('conversations');
export const conversationItems = createStandardTable(
  'conversation_items',
  (_) => ({
    conversationIdIdx: index('conversation_items_conversation_id_idx').on(
      sql`((data->>'conversationId'))`,
    ),
  }),
);
export const secrets = createStandardTable('secrets');
export const tasks = createSharedTable('tasks', (_) => ({
  userIdIdx: index('tasks_user_id_idx').on(sql`((data->>'userId'))`),
  statusIdx: index('tasks_status_idx').on(sql`((data->>'status'))`),
  taskNameIdx: index('tasks_task_name_idx').on(sql`((data->>'taskName'))`),
}));
