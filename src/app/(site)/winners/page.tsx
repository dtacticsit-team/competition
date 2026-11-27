import type { Metadata } from "next";
import Link from "next/link";
import { asc, desc, eq, isNotNull, and } from "drizzle-orm";
import { Heart } from "lucide-react";
import { EmptyState, RankBadge } from "@/components/blocks";
import { db } from "@/db";
import { competitions, submissions, users, winners } from "@/db/schema";
import { getAppId } from "@/lib/app-config";
import { processLifecycle } from "@/lib/competitions";
import { fmtDate, imageUrl, inr, num } from "@/lib/format";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("winners.title"), description: t("winners.text") };
}

export default async function WinnersPage() {
  await processLifecycle();
  const { t, locale } = await getT();
  const appId = getAppId();
  // Only results an admin has approved are ever shown here.
  const rows = await db
    .select({
      competitionId: competitions.id,
      competitionTitle: competitions.title,
      endAt: competitions.endAt,
      rank: winners.rank,
      likes: winners.finalLikes,
      prize: winners.prizeAmount,
      submissionId: winners.submissionId,
      name: users.name,
      imageId: submissions.imageId,
      title: submissions.title,
    })
    .from(winners)
    .innerJoin(competitions, eq(competitions.id, winners.competitionId))
    .innerJoin(users, eq(users.id, winners.userId))
    .innerJoin(submissions, eq(submissions.id, winners.submissionId))
    .where(and(eq(winners.appId, appId), eq(competitions.appId, appId), isNotNull(winners.publishedAt)))
    .orderBy(desc(competitions.endAt), asc(winners.rank));

  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(r.competitionId, [...(groups.get(r.competitionId) ?? []), r]);
  const rankLabel = [t("competition.prizeFirst"), t("competition.prizeSecond"), t("competition.prizeThird")];

  return (
    <div className="page pt-8 sm:pt-12">
      <h1 className="text-3xl font-semibold text-navy sm:text-4xl">{t("winners.title")}</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-muted">{t("winners.text")}</p>

      {groups.size === 0 ? (
        <div className="mt-8">
          <EmptyState title={t("winners.emptyTitle")} text={t("winners.emptyText")}>
            <Link href="/competitions" className="btn btn-navy">
              {t("home.browseCompetitions")}
            </Link>
          </EmptyState>
        </div>
      ) : (
        <div className="mt-10 space-y-14">
          {[...groups.values()].map((list) => (
            <section key={list[0].competitionId} aria-label={list[0].competitionTitle}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
                <h2 className="text-2xl font-semibold text-navy">
                  <Link href={`/competitions/${list[0].competitionId}`} className="hover:underline">
                    {list[0].competitionTitle}
                  </Link>
                </h2>
                <p className="text-sm text-muted">{fmtDate(list[0].endAt, locale)}</p>
              </div>
              <ol className="mt-5 grid gap-5 sm:grid-cols-3">
                {list.map((w) => (
                  <li key={w.rank}>
                    <Link href={`/p/${w.submissionId}`} className="card group block overflow-hidden transition hover:-translate-y-0.5 hover:border-navy/30">
                      <div className="relative aspect-square overflow-hidden bg-sand">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageUrl(w.imageId, true)} alt={w.title ?? t("feed.imageAlt", { name: w.name })} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                        <span className="absolute top-3 left-3 inline-flex items-center gap-2 rounded-full bg-paper/95 py-1 pr-3 pl-1 text-xs font-semibold text-ink shadow-sm">
                          <RankBadge rank={w.rank} />
                          {rankLabel[w.rank - 1]}
                        </span>
                      </div>
                      <div className="p-4">
                        <p className="truncate text-base font-semibold text-ink">{w.name}</p>
                        <p className="mt-1.5 flex items-center justify-between text-sm">
                          <span className="inline-flex items-center gap-1.5 text-muted">
                            <Heart className="h-4 w-4 fill-rose text-rose" aria-hidden="true" />
                            {num(w.likes)} {t(w.likes === 1 ? "dashboard.likeOne" : "dashboard.likes")}
                          </span>
                          <span className="text-base font-semibold text-navy tabular-nums">{inr(w.prize)}</span>
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
