import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";

export function DashboardStatCard({
  label,
  value,
  href,
  description,
}: {
  label: string;
  value: number;
  href: string;
  description: string;
}) {
  return (
    <Card>
      <CardBody className="flex min-w-0 flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">{label}</p>
        <p className="text-3xl font-medium tabular-nums text-ink">{value}</p>
        <p className="text-sm leading-6 text-ink-muted">{description}</p>
        <Link
          href={href}
          className="text-sm text-accent hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          View {label.toLowerCase()}
        </Link>
      </CardBody>
    </Card>
  );
}
