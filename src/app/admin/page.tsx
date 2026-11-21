import Link from "next/link";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { Heart, ImageIcon, Plus, Radio, ShieldAlert, Trophy, Users } from "lucide-react";
import { approveResultsAction, cancelCompetitionAction, setFlaggedVotesAction } from "@/app/actions/admin";
import { EmptyState, RankBadge } from "@/components/blocks";
import { StatusPill } from "@/components/brand";
import { ConfirmButton } from "@/components/forms";
import { db } from "@/db";
import { competitions, registrations, submissions, users, votes, winners } from "@/db/schema";
import { getPhase, processLifecycle } from "@/lib/competitions";
import { fmtDateTime, imageUrl, inr, num } from "@/lib/format";
import { getT } from "@/lib/i18n";

export default async function AdminDashboard() {
  await processLifecycle();
  const { t, locale } = await getT();
  const now = new Date();
  const [all, [{ participants }], totalEntries, totalLikes, pendingWinners, flagged] = await Promise.all([
    db
      .select({
        c: competitions,
        participants: sql<number>`(select count(*)::int from registrations r where r.competition_id = "competitions"."id")`,
        entries: sql<number>`(select count(*)::int from submissions s where s.competition_id = "competitions"."id")`,
      })
      .from(competitions)
      .orderBy(desc(competitions.createdAt)),
    db.select({ participants: sql<number>`count(distinct user_id)::int` }).from(registrations),
    db.$count(submissions),
    db.$count(votes, eq(votes.eligible, true)),
    db
      .select({ competitionId: winners.competitionId, rank: winners.rank, likes: winners.finalLikes, prize: winners.prizeAmount, submissionId: winners.submissionId, name: users.name, imageId: submissions.imageId })
      .from(winners)
      .innerJoin(users, eq(users.id, winners.userId))
      .innerJoin(submissions, eq(submissions.id, winners.submissionId))
      .where(isNull(winners.publishedAt))
      .orderBy(asc(winners.rank)),
    db
      .select({
        submissionId: votes.submissionId,
        flagged: sql<number>`count(*)::int`,
        excluded: sql<number>`(count(*) filter (where not "votes"."eligible"))::int`,
        name: users.name,
        imageId: submissions.imageId,
        competitionTitle: competitions.title,
      })
      .from(votes)
      .innerJoin(submissions, eq(submissions.id, votes.submissionId))
      .innerJoin(users, eq(users.id, submissions.userId))
      .innerJoin(competitions, eq(competitions.id, submissions.competitionId))
      .where(and(eq(votes.suspicious, true), isNull(competitions.resultsPublishedAt)))
      .groupBy(votes.submissionId, users.name, submissions.imageId, competitions.title),
  ]);

  const rows = all.map((x) => ({ ...x, phase: getPhase(x.c, now) }));
  const pending = rows.filter((x) => x.c.status === "closed" && x.c.finalizedAt && !x.c.resultsPublishedAt);
  const stats = [
    { label: t("admin.statCompetitions"), value: rows.length, icon: Trophy, tint: "bg-marigold/15 text-saffron" },
    { label: t("admin.statActive"), value: rows.filter((x) => x.phase === "open").length, icon: Radio, tint: "bg-leaf-soft text-leaf" },
    { label: t("admin.statParticipants"), value: participants, icon: Users, tint: "bg-navy/10 text-navy" },
    { label: t("admin.statSubmissions"), value: totalEntries, icon: ImageIcon, tint: "bg-leaf-soft text-leaf" },
    { label: t("admin.statLikes"), value: totalLikes, icon: Heart, tint: "bg-rose/10 text-rose" },
  ];

  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-semibold text-navy">{t("admin.dashboard")}</h1>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${s.tint}`}>
              <s.icon className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <dt className="mt-3 text-xs font-medium text-muted">{s.label}</dt>
            <dd className="mt-0.5 text-2xl font-semibold text-navy tabular-nums">{num(s.value)}</dd>
          </div>
        ))}
      </dl>

      {pending.map(({ c }) => {
        const top = pendingWinners.filter((w) => w.competitionId === c.id);
        return (
          <section key={c.id} aria-label={t("admin.approvalTitle")} className="rounded-2xl border border-leaf/25 bg-leaf-soft p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="eyebrow !text-leaf">{t("admin.approvalTitle")}</p>
                <h2 className="mt-1 text-xl font-semibold text-navy">{c.title}</h2>
                <p className="mt-1 max-w-xl text-sm text-ink/75">{t("admin.approvalText")}</p>
              </div>
              {top.length > 0 && (
                <form action={approveResultsAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <ConfirmButton message={t("admin.approveConfirm")} className="btn btn-navy shrink-0">
                    <Trophy className="h-4 w-4" aria-hidden="true" />
                    {t("admin.approve")}
                  </ConfirmButton>
                </form>
              )}
            </div>
            {top.length === 0 ? (
              <p className="mt-4 text-sm font-medium text-ink/75">{t("admin.noEntriesToRank")}</p>
            ) : (
              <ol className="mt-4 divide-y divide-leaf/15 overflow-hidden rounded-xl bg-paper">
                {top.map((w) => (
                  <li key={w.rank}>
                    <Link href={`/p/${w.submissionId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-sand/40">
                      <RankBadge rank={w.rank} />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl(w.imageId, true)} alt="" className="h-11 w-11 rounded-lg object-cover" />
                      <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{w.name}</span>
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums">
                        {num(w.likes)}
                        <Heart className="h-4 w-4 fill-rose text-rose" aria-hidden="true" />
                      </span>
                      <span className="w-20 text-right text-sm font-semibold text-navy tabular-nums">{inr(w.prize)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}

      {flagged.length > 0 && (
        <section aria-labelledby="review-title">
          <h2 id="review-title" className="flex items-center gap-2 text-xl font-semibold text-navy">
            <ShieldAlert className="h-5 w-5 text-saffron" aria-hidden="true" />
            {t("admin.reviewTitle")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t("admin.reviewText")}</p>
          <ul className="card mt-4 divide-y divide-line overflow-hidden">
            {flagged.map((f) => {
              const isExcluded = f.excluded > 0;
              return (
                <li key={f.submissionId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl(f.imageId, true)} alt="" className="h-11 w-11 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/p/${f.submissionId}`} className="block truncate text-[15px] font-medium hover:underline">
                      {f.name}
                    </Link>
                    <p className="truncate text-xs text-muted">
                      {f.competitionTitle} · {t("admin.flaggedCount", { count: f.flagged })}
                      {isExcluded && ` · ${t("admin.excluded")}`}
                    </p>
                  </div>
                  <form action={setFlaggedVotesAction}>
                    <input type="hidden" name="submissionId" value={f.submissionId} />
                    <input type="hidden" name="eligible" value={isExcluded ? "true" : "false"} />
                    <button className={`btn btn-sm ${isExcluded ? "btn-outline" : "btn-danger"}`}>{isExcluded ? t("admin.restore") : t("admin.exclude")}</button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="setup-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="setup-title" className="text-xl font-semibold text-navy">
            {t("admin.competitionsTitle")}
          </h2>
          <Link href="/admin/competitions/new" className="btn btn-primary btn-sm">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("admin.newCompetition")}
          </Link>
        </div>
        {rows.length === 0 ? (
          <div className="mt-4">
            <EmptyState title={t("admin.noCompetitions")} text={t("admin.noCompetitionsText")}>
              <Link href="/admin/competitions/new" className="btn btn-primary">
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t("admin.newCompetition")}
              </Link>
            </EmptyState>
          </div>
        ) : (
          <ul className="card mt-4 divide-y divide-line overflow-hidden">
            {rows.map(({ c, phase, participants: p, entries }) => {
              const editable = c.status !== "cancelled" && !c.finalizedAt;
              return (
                <li key={c.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-semibold text-ink">{c.title}</p>
                      <StatusPill phase={phase} label={t(`status.${phase}`)} />
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {fmtDateTime(c.startAt, locale)} – {fmtDateTime(c.endAt, locale)} {t("competition.ist")}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {num(p)} {t(p === 1 ? "competition.participantOne" : "competition.participants")} · {num(entries)} {t(entries === 1 ? "competition.entryOne" : "competition.entries")}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {c.status !== "draft" && (
                      <Link href={`/competitions/${c.id}`} className="btn btn-outline btn-sm">
                        {t("common.view")}
                      </Link>
                    )}
                    {editable && (
                      <Link href={`/admin/competitions/${c.id}`} className="btn btn-outline btn-sm">
                        {t("common.edit")}
                      </Link>
                    )}
                    {c.status !== "cancelled" && !c.resultsPublishedAt && (
                      <form action={cancelCompetitionAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <ConfirmButton message={t("admin.cancelConfirm")} className="btn btn-danger btn-sm">
                          {t("admin.cancelCompetition")}
                        </ConfirmButton>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
