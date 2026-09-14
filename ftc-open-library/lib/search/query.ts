const MAX_QUERY_LENGTH = 200;

/**
 * Plain English query for `search_vector` (title + description).
 * Strips tsquery operators so user input cannot change FTS logic.
 */
export function toFtsQuery(raw: string): string | null {
  const cleaned = raw
    .replace(/['":()!&|<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_LENGTH);

  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Safe ILIKE contains pattern. Rejects wildcard injection.
 */
export function ilikeContainsPattern(raw: string): string | null {
  const cleaned = raw
    .replace(/[%_\\,()*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  if (cleaned.length < 2) {
    return null;
  }

  return `%${cleaned}%`;
}

export function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

export function intersectIds(left: readonly string[] | undefined, right: readonly string[]): string[] {
  if (!left || left.length === 0) {
    return [...right];
  }
  const allow = new Set(left);
  return right.filter((id) => allow.has(id));
}

export function formatResultCount(total: number, query: string): string {
  const noun = total === 1 ? "resource" : "resources";
  if (query) {
    return `${total} ${noun} found`;
  }
  return `${total} ${noun}`;
}
