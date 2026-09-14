"use client";

import { useState, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { loginPath } from "@/lib/auth/paths";
import { canDiscuss, type AccessSnapshot } from "@/lib/auth/permissions";
import { createDiscussion } from "@/lib/discussion/actions";
import { DISCUSSION_BODY_MAX } from "@/lib/discussion/validation";

export function DiscussionComposer({
  resourceId,
  resourceSlug,
  access,
  parentId = null,
  onPosted,
  compact = false,
}: {
  resourceId: string;
  resourceSlug: string;
  access: AccessSnapshot;
  parentId?: string | null;
  onPosted?: () => void;
  compact?: boolean;
}) {
  const returnTo = `/resources/${resourceSlug}#discussion`;

  if (access.level === "guest") {
    return (
      <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface p-4">
        <p className="text-sm text-ink-muted">Sign in to join this discussion.</p>
        <ButtonLink href={loginPath(returnTo)} variant="secondary" className="w-full sm:w-auto">
          Sign in to discuss
        </ButtonLink>
      </div>
    );
  }

  if (!canDiscuss(access)) {
    return (
      <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface p-4">
        <p className="text-sm text-ink-muted">Verify your email to join this discussion.</p>
        <ButtonLink href="/verify?reason=discuss" variant="secondary" className="w-full sm:w-auto">
          Verify to discuss
        </ButtonLink>
      </div>
    );
  }

  return (
    <DiscussionComposerForm
      resourceId={resourceId}
      parentId={parentId}
      onPosted={onPosted}
      compact={compact}
    />
  );
}

function DiscussionComposerForm({
  resourceId,
  parentId,
  onPosted,
  compact,
}: {
  resourceId: string;
  parentId: string | null;
  onPosted?: () => void;
  compact: boolean;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isReply = Boolean(parentId);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createDiscussion({ resourceId, body, parentId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      onPosted?.();
    });
  }

  return (
    <form
      className="flex min-w-0 flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Textarea
        id={isReply ? `discussion-reply-${parentId}` : "discussion-composer"}
        name="body"
        label={compact || isReply ? undefined : "Write a question or comment"}
        placeholder={
          isReply ? "Write a reply" : "Write a question or comment"
        }
        value={body}
        maxLength={DISCUSSION_BODY_MAX}
        disabled={pending}
        error={error ?? undefined}
        hint={`${body.trim().length} / ${DISCUSSION_BODY_MAX}`}
        onChange={(event) => setBody(event.target.value)}
      />
      <div>
        <Button type="submit" disabled={pending || body.trim().length === 0} size={compact ? "sm" : "md"}>
          {pending ? "Posting..." : isReply ? "Post reply" : "Post discussion"}
        </Button>
      </div>
    </form>
  );
}
