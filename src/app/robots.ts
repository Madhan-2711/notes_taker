import type { MetadataRoute } from "next";
import { isIndexableDeployment, productionSiteUrl } from "../lib/seo";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = productionSiteUrl();
  return {
    rules: { userAgent: "*", allow: "/" },
    ...(siteUrl && isIndexableDeployment() ? { sitemap: new URL("/sitemap.xml", siteUrl).href } : {}),
  };
}
