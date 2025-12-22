import type { ExtraColumnsConfig } from '@backend/infrastructure/repos/domain/ExtraColumnsConfig';

/**
 * Extracts values for extra columns from the data object.
 * Returns undefined if no extra columns are configured.
 */
export function extractExtraColumnValues<
  T,
  D extends Record<string, unknown> = Record<string, unknown>,
>(
  data: D,
  extraColumns?: ExtraColumnsConfig<T>,
): Record<string, unknown> | undefined {
  if (!extraColumns) {
    return undefined;
  }

  const values: Record<string, unknown> = {};

  for (const [columnName, fieldName] of Object.entries(
    extraColumns.columnToField,
  )) {
    if (fieldName in data) {
      values[columnName] = data[fieldName];
    }
  }

  return Object.keys(values).length > 0 ? values : undefined;
}
