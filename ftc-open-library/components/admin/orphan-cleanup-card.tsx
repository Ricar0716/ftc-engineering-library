"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { cleanupOrphanUploads, type CleanupResult, type UploadHygiene } from "@/lib/admin/storage-actions";
import { uploadLimits } from "@/lib/config/uploads";

type State = { message: string | null; ok: boolean };

const INITIAL: State = { message: null, ok: true };

/**
 * Diagnostic counts plus a manual sweep. The scheduled route does the same work
 * on a timer; this exists so an admin can see the numbers and retry a failure.
 */
export function OrphanCleanupCard({ hygiene }: { hygiene: UploadHygiene | null }) {
  const [state, formAction, pending] = useActionState(async (): Promise<State> => {
    const result: CleanupResult = await cleanupOrphanUploads();
    return { message: result.message, ok: result.ok };
  }, INITIAL);

  const orphans = hygiene?.orphanCandidates ?? 0;

  return (
    <Card>
      <CardBody className="flex h-full flex-col gap-3">
        <p className="font-mono text-xs uppercase tracking-wide text-accent">Ready</p>
        <h2 className="text-base font-medium text-ink">Upload hygiene</h2>
        {hygiene ? (
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-ink-muted">Orphans</dt>
              <dd className="font-mono text-ink">{orphans}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Open</dt>
              <dd className="font-mono text-ink">{hygiene.openIntents}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Abandoned</dt>
              <dd className="font-mono text-ink">{hygiene.abandonedIntents}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Leftover objects</dt>
              <dd className="font-mono text-ink">{hygiene.leftoverObjects}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm leading-6 text-ink-muted">Counts are unavailable on this server.</p>
        )}
        <p className="text-sm leading-6 text-ink-muted">
          Uploaded objects with no registered file and no live authorization, older than{" "}
          {uploadLimits.orphanGraceHours} hours, in <code>resource-files</code> or{" "}
          <code>tutorial-videos</code>. Leftover objects are cancelled or expired reservations whose
          bytes are still in Storage and still count toward quota.
        </p>
        <form action={formAction} className="mt-auto">
          <Button type="submit" variant="secondary" disabled={pending || orphans === 0}>
            {pending ? "Sweeping…" : "Sweep orphans"}
          </Button>
        </form>
        <p role="status" aria-live="polite" className="min-h-5 text-sm">
          {state.message ? (
            <span className={state.ok ? "text-ink-muted" : "text-danger"}>{state.message}</span>
          ) : null}
        </p>
      </CardBody>
    </Card>
  );
}
