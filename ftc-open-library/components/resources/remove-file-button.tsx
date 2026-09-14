"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { removeResourceFile } from "@/lib/resources/actions";
import { EMPTY_RESOURCE_FORM_STATE } from "@/lib/resources/form-state";

export function RemoveFileButton({
  resourceId,
  fileId,
  filename,
}: {
  resourceId: string;
  fileId: string;
  filename: string;
}) {
  const [state, formAction, pending] = useActionState(
    removeResourceFile,
    EMPTY_RESOURCE_FORM_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="resourceId" value={resourceId} />
      <input type="hidden" name="fileId" value={fileId} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Removing…" : "Remove"}
        <span className="sr-only"> {filename}</span>
      </Button>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
