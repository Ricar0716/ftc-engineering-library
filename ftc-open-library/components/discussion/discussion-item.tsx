"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { DiscussionComposer } from "@/components/discussion/discussion-composer";
import {
  DiscussionBody,
  DiscussionMeta,
  DiscussionReply,
} from "@/components/discussion/discussion-reply";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/ui/user-avatar";
import { canAccessAdmin, canDiscuss, type AccessSnapshot } from "@/lib/auth/permissions";
import { hideDiscussion, restoreDiscussion, updateDiscussion } from "@/lib/discussion/actions";
import type { DiscussionPost, DiscussionThread } from "@/lib/discussion/queries";
import { DISCUSSION_BODY_MAX } from "@/lib/discussion/validation";
import { contributorHref } from "@/lib/identity/paths";

export function DiscussionItem({
  thread,
  resourceId,
  resourceSlug,
  resourceAuthorId,
  teamOwnerId,
  access,
}: {
  thread: DiscussionThread;
  resourceId: string;
  resourceSlug: string;
  resourceAuthorId: string | null;
  teamOwnerId: string | null;
  access: AccessSnapshot;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const isAdmin = canAccessAdmin(access);
  const canReply = canDiscuss(access) && thread.status === "VISIBLE";

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex min-w-0 items-start gap-3">
        <DiscussionAuthorLink post={thread} />
        <div className="min-w-0 flex-1">
          <DiscussionMeta
            post={thread}
            resourceAuthorId={resourceAuthorId}
            teamOwnerId={teamOwnerId}
          />
          <DiscussionPostEditor post={thread} access={access} isAdmin={isAdmin} />
        </div>
      </div>

      {thread.replies.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-4 pl-2 sm:pl-11">
          {thread.replies.map((reply) => (
            <DiscussionReply key={reply.id}>
              <DiscussionMeta
                post={reply}
                resourceAuthorId={resourceAuthorId}
                teamOwnerId={teamOwnerId}
              />
              <DiscussionPostEditor post={reply} access={access} isAdmin={isAdmin} />
            </DiscussionReply>
          ))}
        </div>
      ) : null}

      {canReply ? (
        <div className="pl-2 sm:pl-11">
          {replyOpen ? (
            <DiscussionComposer
              resourceId={resourceId}
              resourceSlug={resourceSlug}
              access={access}
              parentId={thread.id}
              compact
              onPosted={() => setReplyOpen(false)}
            />
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={() => setReplyOpen(true)}>
              Reply
            </Button>
          )}
        </div>
      ) : null}
    </article>
  );
}

function DiscussionAuthorLink({ post }: { post: DiscussionPost }) {
  const avatar = <UserAvatar name={post.author.displayName} src={post.author.avatarUrl} size="sm" />;
  if (!post.author.username) {
    return avatar;
  }

  return (
    <Link href={contributorHref(post.author.username)} className="shrink-0 hover:opacity-90">
      {avatar}
    </Link>
  );
}

function DiscussionPostEditor({
  post,
  access,
  isAdmin,
}: {
  post: DiscussionPost;
  access: AccessSnapshot;
  isAdmin: boolean;
}) {
  const canEdit = access.userId === post.author.id && post.status === "VISIBLE" && canDiscuss(access);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(post.body);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    const showActions = canEdit || isAdmin;
    return (
      <>
        <DiscussionBody post={post} viewerUserId={access.userId} isAdmin={isAdmin} />
        {showActions ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {canEdit ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
            ) : null}
            <DiscussionModeration post={post} isAdmin={isAdmin} />
          </div>
        ) : null}
      </>
    );
  }

  return (
    <form
      className="mt-2 flex min-w-0 flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await updateDiscussion({ id: post.id, body });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setEditing(false);
        });
      }}
    >
      <Textarea
        name="body"
        value={body}
        maxLength={DISCUSSION_BODY_MAX}
        disabled={pending}
        error={error ?? undefined}
        onChange={(event) => setBody(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending || body.trim().length === 0}>
          {pending ? "Saving..." : "Save"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            setBody(post.body);
            setEditing(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function DiscussionModeration({
  post,
  isAdmin,
}: {
  post: Pick<DiscussionPost, "id" | "status">;
  isAdmin: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!isAdmin) {
    return null;
  }

  const hidden = post.status !== "VISIBLE";

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = hidden ? await restoreDiscussion(post.id) : await hideDiscussion(post.id);
            if (!result.ok) {
              setError(result.error);
            }
          });
        }}
      >
        {pending ? "Updating..." : hidden ? "Restore" : "Hide"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </>
  );
}
