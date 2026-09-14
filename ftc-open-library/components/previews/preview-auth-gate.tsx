import { ButtonLink } from "@/components/ui/button";
import { loginPath } from "@/lib/auth/paths";
import type { AccessSnapshot } from "@/lib/auth/permissions";
import { canDownload } from "@/lib/auth/permissions";

export function PreviewAuthGate({
  access,
  resourceSlug,
  children,
}: {
  access: AccessSnapshot;
  resourceSlug: string;
  children: React.ReactNode;
}) {
  if (canDownload(access)) {
    return children;
  }

  const returnTo = `/resources/${resourceSlug}`;

  if (access.level === "unverified") {
    return (
      <div className="rounded-lg border border-dashed border-line bg-surface px-5 py-8">
        <h3 className="text-base font-medium text-ink">Verify your email to preview</h3>
        <p className="mt-2 max-w-prose text-sm leading-6 text-ink-muted">
          File names are public. Opening a CAD, code, or image preview uses the same verified
          session as downloads.
        </p>
        <div className="pt-4">
          <ButtonLink href="/verify?reason=download" variant="secondary" size="sm">
            Verify your email
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-line bg-surface px-5 py-8">
      <h3 className="text-base font-medium text-ink">Sign in to preview</h3>
      <p className="mt-2 max-w-prose text-sm leading-6 text-ink-muted">
        Guests can browse this resource. In-browser previews and downloads need a verified account
        so private Storage is never exposed publicly.
      </p>
      <div className="pt-4">
        <ButtonLink href={loginPath(returnTo)} variant="secondary" size="sm">
          Sign in to preview
        </ButtonLink>
      </div>
    </div>
  );
}
