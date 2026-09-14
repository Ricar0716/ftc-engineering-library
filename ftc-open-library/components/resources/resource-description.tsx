import { EmptyState } from "@/components/ui/empty-state";
import { DETAIL_EMPTY } from "@/lib/resources/detail-ui";

export function ResourceDescription({
  description,
  changelog,
}: {
  description: string;
  changelog: string | null;
}) {
  const overview = description.trim();
  const notes = changelog?.trim() ?? "";

  if (!overview && !notes) {
    return (
      <section className="flex min-w-0 flex-col gap-3">
        <h2 className="text-lg font-medium">Overview</h2>
        <EmptyState
          title={DETAIL_EMPTY.description}
          description="You can still inspect the preview and files if they are listed."
        />
      </section>
    );
  }

  return (
    <section className="flex min-w-0 flex-col gap-6">
      {overview ? (
        <div className="flex min-w-0 flex-col gap-3">
          <h2 className="text-lg font-medium">Overview</h2>
          <p className="max-w-3xl text-base leading-7 text-ink-muted whitespace-pre-wrap">
            {overview}
          </p>
        </div>
      ) : null}
      {notes ? (
        <div className="flex min-w-0 flex-col gap-3">
          <h2 className="text-lg font-medium">Changes</h2>
          <p className="max-w-3xl text-base leading-7 text-ink-muted whitespace-pre-wrap">{notes}</p>
        </div>
      ) : null}
    </section>
  );
}
