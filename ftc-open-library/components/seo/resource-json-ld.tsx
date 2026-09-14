import { contributorHref, teamHref } from "@/lib/identity/paths";
import { canonicalUrl } from "@/lib/seo/site-url";

function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function ResourceJsonLd({
  title,
  description,
  slug,
  publishedAt,
  updatedAt,
  authorName,
  authorUsername,
  teamName,
  teamNumber,
}: {
  title: string;
  description: string;
  slug: string;
  publishedAt: string | null;
  updatedAt: string | null;
  authorName: string | null;
  authorUsername: string | null;
  teamName: string | null;
  teamNumber: string | null;
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: title,
    description,
    url: canonicalUrl(`/resources/${slug}`),
  };

  if (publishedAt) {
    data.datePublished = publishedAt;
  }
  if (updatedAt) {
    data.dateModified = updatedAt;
  }
  if (authorUsername && authorName) {
    data.author = {
      "@type": "Person",
      name: authorName,
      url: canonicalUrl(contributorHref(authorUsername)),
    };
  } else if (teamNumber) {
    data.author = {
      "@type": "Organization",
      name: teamName ?? `FTC Team ${teamNumber}`,
      url: canonicalUrl(teamHref(teamNumber)),
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLd(data) }}
    />
  );
}
