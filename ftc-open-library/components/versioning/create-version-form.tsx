"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EMPTY_RESOURCE_FORM_STATE } from "@/lib/resources/form-state";
import {
  startResourceRevision,
  submitResourceRevision,
  updateRevisionChangelog,
  withdrawResourceRevision,
} from "@/lib/versioning/actions";
import { VERSION_CHANGELOG_MAX, VERSION_LABEL_MAX } from "@/lib/versioning/validation";

export function CreateVersionForm({
  resourceId,
  nextLabel,
}: {
  resourceId: string;
  nextLabel: string;
}) {
  const [state, action, pending] = useActionState(startResourceRevision, EMPTY_RESOURCE_FORM_STATE);

  return (
    <form action={action} className="flex min-w-0 flex-col gap-3">
      <input type="hidden" name="resourceId" value={resourceId} />
      <Input
        name="versionLabel"
        label="Version name"
        defaultValue={nextLabel}
        maxLength={VERSION_LABEL_MAX}
        hint="Example: v1.1 or Worlds version"
      />
      <Textarea
        name="changelog"
        label="Changelog"
        placeholder={"- Updated intake geometry\n- Improved autonomous path"}
        maxLength={VERSION_CHANGELOG_MAX}
        error={state.fieldErrors?.changelog}
      />
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create new version"}
      </Button>
    </form>
  );
}

export function RevisionNotesForm({
  resourceId,
  versionId,
  versionLabel,
  changelog,
}: {
  resourceId: string;
  versionId: string;
  versionLabel: string | null;
  changelog: string | null;
}) {
  const [state, action, pending] = useActionState(updateRevisionChangelog, EMPTY_RESOURCE_FORM_STATE);

  return (
    <form action={action} className="flex min-w-0 flex-col gap-3">
      <input type="hidden" name="resourceId" value={resourceId} />
      <input type="hidden" name="versionId" value={versionId} />
      <Input
        name="versionLabel"
        label="Version name"
        defaultValue={versionLabel ?? ""}
        maxLength={VERSION_LABEL_MAX}
      />
      <Textarea
        name="changelog"
        label="Changelog"
        defaultValue={changelog ?? ""}
        maxLength={VERSION_CHANGELOG_MAX}
        error={state.fieldErrors?.changelog}
        hint="Required before you submit this version for review."
      />
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Save version notes"}
      </Button>
    </form>
  );
}

export function SubmitRevisionForm({
  resourceId,
  versionId,
  blockers,
}: {
  resourceId: string;
  versionId: string;
  blockers: string[];
}) {
  const [state, action, pending] = useActionState(submitResourceRevision, EMPTY_RESOURCE_FORM_STATE);

  return (
    <form action={action} className="flex min-w-0 flex-col gap-3">
      <input type="hidden" name="resourceId" value={resourceId} />
      <input type="hidden" name="versionId" value={versionId} />
      {blockers.length > 0 ? (
        <ul className="list-disc pl-5 text-sm text-danger">
          {blockers.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || blockers.length > 0}>
        {pending ? "Submitting…" : "Submit version for review"}
      </Button>
    </form>
  );
}

export function WithdrawRevisionForm({
  resourceId,
  versionId,
}: {
  resourceId: string;
  versionId: string;
}) {
  const [state, action, pending] = useActionState(withdrawResourceRevision, EMPTY_RESOURCE_FORM_STATE);

  return (
    <form action={action} className="flex min-w-0 flex-col gap-3">
      <input type="hidden" name="resourceId" value={resourceId} />
      <input type="hidden" name="versionId" value={versionId} />
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Withdrawing..." : "Withdraw this version"}
      </Button>
    </form>
  );
}
