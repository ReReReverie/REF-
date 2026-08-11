import type { MetadataRoute } from "next";
import { getSiteUrl, isIndexableDeployment } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  const isIndexable = isIndexableDeployment();

  return {
    rules: isIndexable
      ? { userAgent: "*", allow: "/" }
      : { userAgent: "*", disallow: "/" },
    sitemap: isIndexable ? new URL("/sitemap.xml", siteUrl).toString() : undefined,
    host: isIndexable ? siteUrl.origin : undefined,
  };
}
