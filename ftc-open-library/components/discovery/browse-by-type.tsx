import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import {
  RESOURCE_TYPE_BLURBS,
  RESOURCE_TYPE_LABELS,
  RESOURCE_TYPE_PURPOSE,
  RESOURCE_TYPES,
} from "@/lib/constants/resources";

export function BrowseByType() {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h2 className="text-xl font-medium">Browse by type</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {RESOURCE_TYPES.map((type) => (
          <li key={type}>
            <Link href={`/explore?type=${type}`} className="block h-full min-w-0">
              <Card className="h-full transition-colors hover:border-accent/40">
                <CardBody className="flex h-full flex-col gap-2">
                  <p className="font-mono text-xs uppercase tracking-wide text-accent">
                    {RESOURCE_TYPE_LABELS[type]}
                  </p>
                  <p className="text-sm font-medium text-ink">{RESOURCE_TYPE_PURPOSE[type]}</p>
                  <p className="text-sm leading-6 text-ink-muted">{RESOURCE_TYPE_BLURBS[type]}</p>
                </CardBody>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
