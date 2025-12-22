/**
 * Configuration for extra database columns beyond standard columns.
 *
 * StandardRepo and SharedRepo use a standard set of columns (id, user_id, created_at,
 * updated_at, data). This interface allows repositories to define additional columns
 * that are stored separately from the JSONB data column.
 *
 * Use cases:
 * - Foreign key relationships with cascading deletes
 * - Indexed columns for efficient queries
 * - Columns that need database-level constraints
 *
 * The mapping is from database column names (snake_case) to domain entity field names (camelCase).
 */

/**
 * Configuration for extra database columns beyond standard columns.
 * Used by StandardRepo to map database columns to domain entity fields.
 *
 * @example
 * ```typescript
 * const extraColumns: ExtraColumnsConfig<ConversationItem> = {
 *   columnToField: {
 *     conversation_id: 'conversationId',
 *   },
 * };
 * ```
 */
export interface ExtraColumnsConfig<T> {
  /**
   * Maps database column names (snake_case) to domain entity field names (camelCase).
   *
   * When creating/updating, the value of the mapped field is extracted from
   * the data and written to the corresponding column.
   *
   * When reading, the column value is merged into the entity, overriding
   * any value in the JSONB data column (they should be identical).
   *
   * @example
   * ```typescript
   * {
   *   conversation_id: 'conversationId',
   *   parent_task_id: 'parentTaskId',
   * }
   * ```
   */
  readonly columnToField: Readonly<Record<string, keyof T & string>>;
}
