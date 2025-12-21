import type { NumericRange, VectorFilter } from '../domain/VectorSearchQuery';

/**
 * Builds a Redis filter query string from a VectorFilter object.
 * Returns '*' if no filters are specified.
 *
 * Examples:
 * - { tag: { category: 'engineering' } } → "(@category:{engineering})"
 * - { numeric: { year: { min: 2020, max: 2022 } } } → "(@year:[2020 2022])"
 * - { tag: { category: ['a', 'b'] } } → "(@category:{a|b})"
 */
export function buildFilterQuery(filter?: VectorFilter): string {
  if (!filter) {
    return '*';
  }

  const parts: string[] = [];

  // Handle raw filter (escape hatch)
  if (filter.raw) {
    parts.push(filter.raw);
  }

  // Handle TAG filters
  if (filter.tag) {
    for (const [field, value] of Object.entries(filter.tag)) {
      if (Array.isArray(value)) {
        // Multiple values: @field:{val1|val2|val3}
        const escaped = value.map(escapeTagValue).join('|');
        parts.push(`@${field}:{${escaped}}`);
      } else {
        // Single value: @field:{value}
        parts.push(`@${field}:{${escapeTagValue(value)}}`);
      }
    }
  }

  // Handle NUMERIC filters
  if (filter.numeric) {
    for (const [field, range] of Object.entries(filter.numeric)) {
      parts.push(`@${field}:${formatNumericRange(range)}`);
    }
  }

  // Handle TEXT filters
  if (filter.text) {
    for (const [field, query] of Object.entries(filter.text)) {
      parts.push(`@${field}:(${escapeTextQuery(query)})`);
    }
  }

  if (parts.length === 0) {
    return '*';
  }

  // Combine with AND (space-separated in Redis)
  return `(${parts.join(' ')})`;
}

/**
 * Formats a numeric range for Redis query syntax.
 */
function formatNumericRange(range: NumericRange): string {
  const minValue =
    range.min !== undefined
      ? range.minExclusive
        ? `(${range.min}`
        : range.min.toString()
      : '-inf';

  const maxValue =
    range.max !== undefined
      ? range.maxExclusive
        ? `(${range.max}`
        : range.max.toString()
      : '+inf';

  return `[${minValue} ${maxValue}]`;
}

/**
 * Escapes special characters in TAG values.
 */
function escapeTagValue(value: string): string {
  // Escape Redis special characters in TAG values
  return value.replace(/[,.<>{}[\]"':;!@#$%^&*()\-+=~|\\/ ]/g, '\\$&');
}

/**
 * Escapes special characters in TEXT queries.
 */
function escapeTextQuery(query: string): string {
  // Basic escaping for text queries
  return query.replace(/[\\@!{}()|\-=<>[\]":*~^$]/g, '\\$&');
}
