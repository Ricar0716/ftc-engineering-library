import { formatDisplayDate } from "@/lib/utils/dates";
import type { DiscussionPost } from "@/lib/discussion/queries";

export function DiscussionReply({ children }: { children: React.ReactNode }) {
  return <article className="min-w-0 border-l-2 border-line pl-4">{children}</article>;
}

export function DiscussionMeta({
  post,
  resourceAuthorId,
  teamOwnerId,
}: {
  post: DiscussionPost;
  resourceAuthorId: string | null;
  teamOwnerId: string | null;
}) {
  const when = formatDisplayDate(post.createdAt) ?? "Unknown date";
  const isResourceAuthor = resourceAuthorId != null && post.author.id === resourceAuthorId;
  const isTeamOwner = teamOwnerId != null && post.author.id === teamOwnerId;

  return (
    <header className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
      <p className="truncate text-sm font-medium text-ink">{post.author.displayName}</p>
      {post.author.username ? (
        <p className="font-mono text-xs text-ink-muted">@{post.author.username}</p>
      ) : null}
      <time className="font-mono text-xs text-ink-muted" dateTime={post.createdAt}>
        {when}
      </time>
      {isResourceAuthor ? <DiscussionBadge>Author</DiscussionBadge> : null}
      {isTeamOwner ? <DiscussionBadge>Team Owner</DiscussionBadge> : null}
    </header>
  );
}

export function DiscussionBody({
  post,
  viewerUserId,
  isAdmin,
}: {
  post: DiscussionPost;
  viewerUserId: string | null;
  isAdmin: boolean;
}) {
  const hidden = post.status !== "VISIBLE";
  const canSeeBody = !hidden || isAdmin || post.author.id === viewerUserId;

  return (
    <div className="mt-2 min-w-0">
      {hidden ? (
        <p className="mb-2 font-mono text-xs text-ink-muted">
          {post.status === "DELETED"
            ? "Removed from public discussion."
            : "Hidden from public discussion."}
        </p>
      ) : null}
      {canSeeBody ? (
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-ink">{post.body}</p>
      ) : null}
    </div>
  );
}

function DiscussionBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-line bg-accent-soft px-1.5 py-0.5 font-mono text-[11px] text-accent">
      {children}
    </span>
  );
}
