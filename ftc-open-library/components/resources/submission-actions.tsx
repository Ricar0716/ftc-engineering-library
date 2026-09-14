"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  deleteResourceDraft,
  submitResourceForReview,
  withdrawResourceSubmission,
} from "@/lib/resources/actions";
import { EMPTY_RESOURCE_FORM_STATE } from "@/lib/resources/form-state";
import { useUploadActivity } from "./upload-activity";
import { SUBMISSION_BLOCKER_MESSAGES, type SubmissionBlocker } from "@/lib/resources/validation";

function ActionError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <p role="alert" className="text-sm text-danger">
      {message}
    </p>
  );
}

export function SubmitForReviewForm({
  resourceId,
  blockers,
}: {
  resourceId: string;
  blockers: SubmissionBlocker[];
}) {
  const [state, formAction, pending] = useActionState(
    submitResourceForReview,
    EMPTY_RESOURCE_FORM_STATE,
  );
  const [acknowledged, setAcknowledged] = useState(false);
  const checkboxId = useId();
  const blockedId = useId();

  const blocked = blockers.length > 0;
  const { busy: uploadBusy } = useUploadActivity();

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="resourceId" value={resourceId} />

      {blocked ? (
        <div id={blockedId}>
          <p className="text-sm font-medium text-ink">Before you can submit:</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-ink-muted">
            {blockers.map((blocker) => (
              <li key={blocker}>{SUBMISSION_BLOCKER_MESSAGES[blocker]}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <label htmlFor={checkboxId} className="flex items-start gap-2 text-sm text-ink">
        <input
          id={checkboxId}
          type="checkbox"
          name="rightsAcknowledged"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          className="mt-0.5 size-4 rounded border-line"
        />
        <span>I confirm that I have the right to share this content under the selected license.</span>
      </label>

      {uploadBusy ? (
        <p className="text-sm text-ink-muted">
          Wait until the current upload finishes before submitting for review.
        </p>
      ) : null}

      <div>
        <Button
          type="submit"
          disabled={pending || blocked || !acknowledged || uploadBusy}
          aria-describedby={blocked ? blockedId : undefined}
        >
          {pending ? "Submitting…" : "Submit for review"}
        </Button>
      </div>

      <ActionError message={state.error} />
      <p className="text-sm text-ink-muted">
        Submitting locks editing until a Site Admin responds. Nothing becomes public without review.
      </p>
    </form>
  );
}

export function WithdrawSubmissionForm({ resourceId }: { resourceId: string }) {
  const [state, formAction, pending] = useActionState(
    withdrawResourceSubmission,
    EMPTY_RESOURCE_FORM_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="resourceId" value={resourceId} />
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Withdrawing…" : "Withdraw submission"}
        </Button>
      </div>
      <ActionError message={state.error} />
      <p className="text-sm text-ink-muted">
        Withdrawing returns this to Draft so you can keep editing. You can submit it again later.
      </p>
    </form>
  );
}

export function DeleteResourceForm({
  resourceId,
  title,
}: {
  resourceId: string;
  title: string;
}) {
  const [state, formAction, pending] = useActionState(
    deleteResourceDraft,
    EMPTY_RESOURCE_FORM_STATE,
  );
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="flex flex-col gap-2">
        <div>
          <Button type="button" variant="secondary" onClick={() => setConfirming(true)}>
            Delete this resource
          </Button>
        </div>
        <p className="text-sm text-ink-muted">
          Deleting removes the draft and its uploaded files permanently.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="resourceId" value={resourceId} />
      <p className="text-sm text-ink">
        Delete “{title}” and its files? This cannot be undone.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? "Deleting…" : "Yes, delete it"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
      <ActionError message={state.error} />
    </form>
  );
}
