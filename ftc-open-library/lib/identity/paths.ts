export function parseIdentityPage(
  input: Record<string, string | string[] | undefined>,
): number {
  const raw = Array.isArray(input.page) ? input.page[0] : input.page;
  const value = Number(raw ?? "1");
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

export function identityPath(pathname: string, page: number): string {
  if (page > 1) {
    return `${pathname}?page=${page}`;
  }
  return pathname;
}

export function contributorHref(username: string): string {
  return `/profile/${username}`;
}

export function teamHref(teamNumber: string): string {
  return `/teams/${teamNumber}`;
}

export function teamIdentityLabel(teamNumber: string): string {
  return `Team ${teamNumber}`;
}
