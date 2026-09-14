import Link from "next/link";

export function PagePagination({
  page,
  pageSize,
  total,
  hrefForPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefForPage: (page: number) => string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) {
    return null;
  }

  const current = Math.min(page, pageCount);
  const previous = current > 1 ? hrefForPage(current - 1) : null;
  const next = current < pageCount ? hrefForPage(current + 1) : null;

  return (
    <nav
      aria-label="Pagination"
      className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-line pt-4"
    >
      <p className="font-mono text-xs text-ink-muted">
        Page {current} of {pageCount}
      </p>
      <div className="flex gap-2">
        {previous ? (
          <Link
            href={previous}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm hover:border-accent/40"
          >
            Previous
          </Link>
        ) : (
          <span className="rounded-md border border-transparent px-3 py-1.5 text-sm text-ink-muted">
            Previous
          </span>
        )}
        {next ? (
          <Link
            href={next}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm hover:border-accent/40"
          >
            Next
          </Link>
        ) : (
          <span className="rounded-md border border-transparent px-3 py-1.5 text-sm text-ink-muted">
            Next
          </span>
        )}
      </div>
    </nav>
  );
}
