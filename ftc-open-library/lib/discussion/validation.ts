export const DISCUSSION_BODY_MIN = 1;
export const DISCUSSION_BODY_MAX = 4000;
export const DISCUSSION_PAGE_SIZE = 20;

export function normalizeDiscussionBody(
  raw: string | null | undefined,
): { ok: true; body: string } | { ok: false; error: "empty" | "too_long" } {
  const body = (raw ?? "").trim();
  if (body.length < DISCUSSION_BODY_MIN) {
    return { ok: false, error: "empty" };
  }
  if (body.length > DISCUSSION_BODY_MAX) {
    return { ok: false, error: "too_long" };
  }
  return { ok: true, body };
}

export function parseDiscussionPage(
  input: Record<string, string | string[] | undefined>,
): number {
  const raw = Array.isArray(input.discussion) ? input.discussion[0] : input.discussion;
  const value = Number(raw ?? "1");
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

export function discussionPageHref(slug: string, page: number): string {
  if (page > 1) {
    return `/resources/${slug}?discussion=${page}#discussion`;
  }
  return `/resources/${slug}#discussion`;
}
