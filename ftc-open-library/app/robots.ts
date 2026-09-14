import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/site-url";

/**
 * Crawler hints only. Disallow is not access control.
 * Admin, dashboard, and private routes still require auth, RLS, and server gates.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/admin/",
        "/dashboard",
        "/dashboard/",
        "/login",
        "/signup",
        "/verify",
        "/forgot-password",
        "/reset-password",
        "/callback",
        "/submit",
        "/my/",
        "/upload",
        "/forbidden",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
