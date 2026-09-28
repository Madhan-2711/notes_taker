import type { MetadataRoute } from "next";
import { isIndexableDeployment, productionSiteUrl } from "../lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = productionSiteUrl();
  return siteUrl && isIndexableDeployment() ? [{ url: siteUrl.href }] : [];
}
