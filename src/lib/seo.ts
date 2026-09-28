import type { Metadata } from "next";

/** Use the public production domain, never a temporary Vercel preview URL. */
export function productionSiteUrl(): URL | null {
  const domain = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!domain) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(domain) ? domain : `https://${domain}`);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return null;
    return new URL(url.origin);
  } catch {
    return null;
  }
}

export function isIndexableDeployment(): boolean {
  if (process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "development") return false;
  return process.env.VERCEL_ENV === "production" || Boolean(productionSiteUrl());
}

export const privatePageMetadata: Metadata = {
  robots: { index: false, follow: false },
};
