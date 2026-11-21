import type { MetadataRoute } from "next";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { competitions, submissions } from "@/db/schema";
import { getBaseUrl } from "@/lib/request";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await getBaseUrl();
  const visible = inArray(competitions.status, ["published", "closed"]);
  const [comps, posts] = await Promise.all([
    db.select({ id: competitions.id, updatedAt: competitions.updatedAt }).from(competitions).where(visible),
    db
      .select({ id: submissions.id, updatedAt: submissions.updatedAt })
      .from(submissions)
      .innerJoin(competitions, eq(competitions.id, submissions.competitionId))
      .where(visible)
      .orderBy(desc(submissions.submittedAt))
      .limit(5000),
  ]);
  return [
    { url: `${base}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/competitions`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/winners`, changeFrequency: "weekly", priority: 0.6 },
    ...comps.map((c) => ({ url: `${base}/competitions/${c.id}`, lastModified: c.updatedAt, priority: 0.8 })),
    ...posts.map((p) => ({ url: `${base}/p/${p.id}`, lastModified: p.updatedAt, priority: 0.5 })),
  ];
}
