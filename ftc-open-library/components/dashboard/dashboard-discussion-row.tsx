import Link from "next/link";
import { formatDisplayDate } from "@/lib/utils/dates";
import type { DashboardDiscussionRow } from "@/lib/dashboard/queries";

export function DashboardDiscussionRow({ post }: { post: DashboardDiscussionRow }) {
  const kind = post.parentId ? "Reply" : "Question";
  const href = post.resourceSlug
    ? `/resources/${post.resourceSlug}#discussion`
    : "/dashboard/discussions";

  return (
    <article className="rounded-lg border border-line bg-surface p-4">
      <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">{kind}</p>
      <h2 className="mt-1 break-words text-base font-medium text-ink">
        <Link
          href={href}
          className="underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {post.resourceTitle}
        </Link>
      </h2>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-ink-muted">{post.body}</p>
      <p className="mt-2 font-mono text-xs text-ink-muted">
        {formatDisplayDate(post.createdAt) ?? "Recently"}
      </p>
    </article>
  );
}
