import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/request";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/dashboard", "/api/"] }],
    sitemap: `${await getBaseUrl()}/sitemap.xml`,
  };
}
