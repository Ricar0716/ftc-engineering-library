"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { reviewResource, setResourceArchived } from "@/lib/admin/review-actions";
import { reviewResourceRevision } from "@/lib/versioning/actions";
import { EMPTY_RESOURCE_FORM_STATE } from "@/lib/resources/form-state";
import { REVIEW_MESSAGE_MAX } from "@/lib/resources/validation";
import type { ReviewDecision } from "@/types/resources";

const DECISIONS: { value: ReviewDecision; label: string; help: string }[] = [
  {
    value: "APPROVED",
    label: "Approve and publish",
    help: "The resource becomes publicly browsable. Original files stay private and downloadable only by verified users.",
  },
  {
    value: "CHANGES_REQUESTED",
    label: "Request changes",
    help: "The contributor can edit and resubmit. A note explaining what to change is required.",
  },
  {
    value: "REJECTED",
    label: "Reject",
    help: "The submission stays private and read-only. Files are kept. A reason is required.",
  },
];

export function ReviewDecisionForm({ resourceId }: { resourceId: string }) {
  const [state, formAction, pending] = useActionState(reviewResource, EMPTY_RESOURCE_FORM_STATE);
  const [decision, setDecision] = useState<ReviewDecision>("APPROVED");
  const [confirmingApproval, setConfirmingApproval] = useState(false);
  const groupId = useId();

  const selected = DECISIONS.find((item) => item.value === decision) ?? DECISIONS[0];
  const messageRequired = decision !== "APPROVED";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="resourceId" value={resourceId} />
      <input type="hidden" name="decision" value={decision} />

      <fieldset className="flex flex-col gap-2">
        <legend id={groupId} className="text-sm font-medium text-ink">
          Decision
        </legend>
        {DECISIONS.map((item) => (
          <label key={item.value} className="flex items-start gap-2 text-sm text-ink">
            <input
              type="radio"
              name="decisionChoice"
              value={item.value}
              checked={decision === item.value}
              onChange={() => {
                setDecision(item.value);
                setConfirmingApproval(false);
              }}
              className="mt-0.5 size-4"
            />
            <span>
              <span className="font-medium">{item.label}</span>
              <span className="block text-ink-muted">{item.help}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <Textarea
        name="message"
        label={messageRequired ? "Review note (required)" : "Review note (optional)"}
        rows={5}
        maxLength={REVIEW_MESSAGE_MAX}
        required={messageRequired}
        error={state.fieldErrors?.message}
        hint="Only the contributor and Site Admins can read this. It is never shown on the public resource page."
      />

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      {decision === "APPROVED" && !confirmingApproval ? (
        <div>
          <Button type="button" onClick={() => setConfirmingApproval(true)}>
            Approve…
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {decision === "APPROVED" ? (
            <p className="w-full text-sm text-ink">
              Publish this resource now? It becomes publicly browsable immediately.
            </p>
          ) : null}
          <Button type="submit" disabled={pending} variant={decision === "REJECTED" ? "danger" : "primary"}>
            {pending ? "Saving…" : selected.label}
          </Button>
          {decision === "APPROVED" ? (
            <Button type="button" variant="secondary" onClick={() => setConfirmingApproval(false)}>
              Cancel
            </Button>
          ) : null}
        </div>
      )}
    </form>
  );
}

export function ArchiveToggleForm({
  resourceId,
  archived,
}: {
  resourceId: string;
  archived: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    setResourceArchived,
    EMPTY_RESOURCE_FORM_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="resourceId" value={resourceId} />
      <input type="hidden" name="archived" value={archived ? "false" : "true"} />
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending
            ? "Saving…"
            : archived
              ? "Restore to published"
              : "Archive (remove from public browsing)"}
        </Button>
      </div>
      <p className="text-sm text-ink-muted">
        Archiving hides a published resource from public browsing. Its data and files are preserved.
      </p>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function ReviewRevisionForm({
  resourceId,
  versionId,
}: {
  resourceId: string;
  versionId: string;
}) {
  const [state, formAction, pending] = useActionState(reviewResourceRevision, EMPTY_RESOURCE_FORM_STATE);
  const [decision, setDecision] = useState<ReviewDecision>("APPROVED");
  const [confirmingApproval, setConfirmingApproval] = useState(false);
  const groupId = useId();

  const selected = DECISIONS.find((item) => item.value === decision) ?? DECISIONS[0];
  const messageRequired = decision !== "APPROVED";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="resourceId" value={resourceId} />
      <input type="hidden" name="versionId" value={versionId} />
      <input type="hidden" name="decision" value={decision} />

      <fieldset className="flex flex-col gap-2">
        <legend id={groupId} className="text-sm font-medium text-ink">
          Version decision
        </legend>
        {DECISIONS.map((item) => (
          <label key={item.value} className="flex items-start gap-2 text-sm text-ink">
            <input
              type="radio"
              name="decisionChoice"
              value={item.value}
              checked={decision === item.value}
              onChange={() => {
                setDecision(item.value);
                setConfirmingApproval(false);
              }}
              className="mt-0.5 size-4"
            />
            <span>
              <span className="font-medium">{item.label}</span>
              <span className="block text-ink-muted">
                {item.value === "APPROVED"
                  ? "This version becomes the latest public release. The resource stays published."
                  : item.help}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <Textarea
        name="message"
        label={messageRequired ? "Review note (required)" : "Review note (optional)"}
        rows={5}
        maxLength={REVIEW_MESSAGE_MAX}
        required={messageRequired}
        error={state.fieldErrors?.message}
        hint="Only the contributor and Site Admins can read this. It is never shown on the public resource page."
      />

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      {decision === "APPROVED" && !confirmingApproval ? (
        <div>
          <Button type="button" onClick={() => setConfirmingApproval(true)}>
            Approve…
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {decision === "APPROVED" ? (
            <p className="w-full text-sm text-ink">
              Publish this version now? Older published versions stay available.
            </p>
          ) : null}
          <Button type="submit" disabled={pending} variant={decision === "REJECTED" ? "danger" : "primary"}>
            {pending ? "Saving…" : selected.label}
          </Button>
          {decision === "APPROVED" ? (
            <Button type="button" variant="secondary" onClick={() => setConfirmingApproval(false)}>
              Cancel
            </Button>
          ) : null}
        </div>
      )}
    </form>
  );
}
