"use client";

import { useEffect, useState } from "react";
import { ButtonLink, buttonClassName } from "@/components/ui/button";
import type { FileDownloadKind } from "@/lib/resources/detail-ui";

export function FileDownloadButton({
  href,
  kind,
  label,
  size = "sm",
  variant,
}: {
  href: string;
  kind: FileDownloadKind;
  label: string;
  size?: "sm" | "md";
  variant?: "primary" | "secondary";
}) {
  const resolvedVariant = variant ?? (kind === "download" ? "primary" : "secondary");

  if (kind !== "download") {
    return (
      <ButtonLink href={href} size={size} variant={resolvedVariant}>
        {label}
      </ButtonLink>
    );
  }

  return <VerifiedFileDownload href={href} label={label} size={size} variant={resolvedVariant} />;
}

const PREPARING_RESET_MS = 2500;

function VerifiedFileDownload({
  href,
  label,
  size,
  variant,
}: {
  href: string;
  label: string;
  size: "sm" | "md";
  variant: "primary" | "secondary";
}) {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!pending) {
      return;
    }

    const timer = window.setTimeout(() => setPending(false), PREPARING_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [pending]);

  return (
    <a
      href={href}
      className={buttonClassName(variant, size)}
      aria-busy={pending || undefined}
      onClick={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        setPending(true);
      }}
    >
      {pending ? "Preparing download…" : label}
    </a>
  );
}
