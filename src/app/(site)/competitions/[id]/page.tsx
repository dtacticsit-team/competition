import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { CalendarDays, CircleCheck, Heart, ImageIcon, Info, Trophy, Users } from "lucide-react";
import { registerForCompetitionAction } from "@/app/actions/competition";
import { EmptyState, PrizeRow, RankBadge, SponsorStrip } from "@/components/blocks";
import { Avatar, StatusPill } from "@/components/brand";
import { Countdown, Feed } from "@/components/feed";
import { db } from "@/db";
import { competitions, registrations, submissions, users, winners } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getPhase, getPrizes, processLifecycle } from "@/lib/competitions";
import { fmtDateTime, imageUrl, inr, num, toLines } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { listSponsors, listSubmissions, PAGE_SIZE } from "@/lib/queries";

type Props = { params: Promise<{ id: string }> };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(id: string) {
  if (!UUID_RE.test(id)) return null;
  const [c] = await db.select().from(competitions).where(eq(competitions.id, id));
  return c && c.status !== "draft" ? c : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await load((await params).id);
  if (!c) return {};
  const image = c.bannerImageId ? `${imageUrl(c.bannerImageId)}?v=og` : "/images/kolam-hero.jpg";
  const description = c.description.slice(0, 180) || undefined;
  return { title: c.title, description, openGraph: { title: c.title, description, images: [image] } };
}

export default async function CompetitionPage({ params }: Props) {
  const { id } = await params;
  await processLifecycle();
  const c = await load(id);
  if (!c) notFound();

  const { t, locale } = await getT();
  const now = new Date();
  const phase = getPhase(c, now);
  const user = await getCurrentUser();
  const [participants, entries, prizes, sponsors, leaderboard, rows, podium] = await Promise.all([
    db.$count(registrations, eq(registrations.competitionId, id)),
    db.$count(submissions, eq(submissions.competitionId, id)),
    getPrizes(),
    listSponsors(),
    phase === "cancelled" ? [] : listSubmissions({ locale, competitionId: id, order: "top", limit: 10 }),
    phase === "cancelled" ? [] : listSubmissions({ locale, competitionId: id, limit: PAGE_SIZE + 1 }),
    phase === "results"
      ? db
          .select({ rank: winners.rank, likes: winners.finalLikes, prize: winners.prizeAmount, submissionId: winners.submissionId, name: users.name, userImageId: users.profileImageId, imageId: submissions.imageId, title: submissions.title })
          .from(winners)
          .innerJoin(users, eq(users.id, winners.userId))
          .innerJoin(submissions, eq(submissions.id, winners.submissionId))
          .where(eq(winners.competitionId, id))
          .orderBy(asc(winners.rank))
      : [],
  ]);
  const [registration] = user
    ? await db.select({ id: registrations.id }).from(registrations).where(and(eq(registrations.userId, user.id), eq(registrations.competitionId, id)))
    : [];
  const [mine] = user
    ? await db.select({ id: submissions.id }).from(submissions).where(and(eq(submissions.userId, user.id), eq(submissions.competitionId, id)))
    : [];

  const banner = {
    open: { cls: "border-leaf/20 bg-leaf-soft text-leaf", icon: CircleCheck, text: t("competition.openBanner") },
    upcoming: { cls: "border-navy/15 bg-navy/5 text-navy", icon: Info, text: t("competition.upcomingBanner", { date: fmtDateTime(c.startAt, locale) }) },
    ended: { cls: "border-line bg-sand text-ink/80", icon: Info, text: t("competition.endedBanner") },
    results: { cls: "border-gold-soft/60 bg-gold-soft/20 text-gold", icon: Trophy, text: t("competition.resultsBanner") },
    cancelled: { cls: "border-rose/20 bg-rose/5 text-rose", icon: Info, text: t("competition.cancelledBanner") },
    draft: { cls: "", icon: Info, text: "" },
  }[phase];
  const prizeLabels: [string, string, string] = [t("competition.prizeFirst"), t("competition.prizeSecond"), t("competition.prizeThird")];
  const rules = toLines(c.rules);
  const facts = [
    { icon: CalendarDays, label: t("competition.starts"), value: `${fmtDateTime(c.startAt, locale)} ${t("competition.ist")}` },
    { icon: CalendarDays, label: t("competition.ends"), value: `${fmtDateTime(c.endAt, locale)} ${t("competition.ist")}` },
    { icon: Users, label: t("competition.participants"), value: num(participants) },
    { icon: ImageIcon, label: t("competition.entries"), value: num(entries) },
  ];

  return (
    <>
      <div className="page pt-4 sm:pt-8">
        <div className="relative isolate overflow-hidden rounded-3xl bg-navy-deep text-white shadow-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.bannerImageId ? imageUrl(c.bannerImageId) : "/images/kolam-hero.jpg"} alt="" fetchPriority="high" className="absolute inset-0 -z-10 h-full w-full object-cover" />
          <div className="absolute inset-0 -z-10 bg-linear-to-t from-navy-deep via-navy-deep/70 to-navy-deep/20" />
          <div className="rise-in flex min-h-[15rem] flex-col items-start justify-end p-6 sm:min-h-[19rem] sm:p-10">
            <StatusPill phase={phase} label={t(`status.${phase}`)} />
            <h1 className="mt-3 max-w-3xl text-3xl leading-tight font-semibold sm:text-5xl">{c.title}</h1>
          </div>
        </div>
      </div>

      <div className="page mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
        {/* Key facts and the call to action come first on phones, as in the reference */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:order-2 lg:self-start">
          <p className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm font-semibold ${banner.cls}`}>
            <banner.icon className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            <span>{banner.text}</span>
          </p>

          <div className="card p-5">
            <dl className="space-y-3.5">
              {facts.map((f) => (
                <div key={f.label} className="flex items-start gap-3">
                  <f.icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-navy" aria-hidden="true" />
                  <div className="min-w-0">
                    <dt className="text-xs font-medium text-muted first-letter:uppercase">{f.label}</dt>
                    <dd className="text-[15px] font-semibold text-ink tabular-nums">{f.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
            {(phase === "open" || phase === "upcoming") && (
              <div className="mt-5 border-t border-line pt-5 text-navy">
                <Countdown
                  targetIso={(phase === "open" ? c.endAt : c.startAt).toISOString()}
                  nowIso={now.toISOString()}
                  label={phase === "open" ? t("countdown.endsIn") : t("countdown.startsIn")}
                />
              </div>
            )}
          </div>

          <div className="card p-5">
            <h2 className="mb-4 flex items-center justify-center gap-2 font-sans text-sm font-semibold tracking-normal text-ink">
              <Trophy className="h-4 w-4 text-marigold" aria-hidden="true" />
              {t("competition.prizes")}
            </h2>
            <PrizeRow prizes={prizes} labels={prizeLabels} />
            {c.prizeInfo && <p className="mt-4 border-t border-line pt-3 text-sm whitespace-pre-line text-muted">{c.prizeInfo}</p>}
          </div>

          {phase === "open" && (
            <div className="space-y-2.5">
              {!user ? (
                <>
                  <Link href={`/login?next=${encodeURIComponent(`/competitions/${id}`)}`} className="btn btn-primary w-full">
                    {t("competition.registerSubmit")}
                  </Link>
                  <p className="text-center text-xs text-muted">{t("competition.loginToJoin")}</p>
                </>
              ) : !registration ? (
                <form action={registerForCompetitionAction}>
                  <input type="hidden" name="competitionId" value={id} />
                  <button className="btn btn-primary w-full">{t("competition.registerSubmit")}</button>
                </form>
              ) : !mine ? (
                <>
                  <Link href={`/competitions/${id}/submit`} className="btn btn-primary w-full">
                    {t("competition.uploadKolam")}
                  </Link>
                  <p className="text-center text-xs font-medium text-leaf">{t("competition.registered")}</p>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <Link href={`/p/${mine.id}`} className="btn btn-navy">
                    {t("competition.viewMyEntry")}
                  </Link>
                  <Link href={`/competitions/${id}/submit`} className="btn btn-outline">
                    {t("competition.editEntry")}
                  </Link>
                </div>
              )}
              <p className="text-center text-xs text-muted">{t("competition.oneEntry")}</p>
            </div>
          )}
        </aside>

        <div className="min-w-0 space-y-10 lg:order-1">
          {podium.length > 0 && (
            <section aria-labelledby="winners-title">
              <h2 id="winners-title" className="text-2xl font-semibold text-navy">
                {t("competition.winnersTitle")}
              </h2>
              <ol className="mt-4 grid gap-4 sm:grid-cols-3">
                {podium.map((w) => (
                  <li key={w.rank}>
                    <Link href={`/p/${w.submissionId}`} className="card group block overflow-hidden transition hover:border-navy/30">
                      <div className="relative aspect-square overflow-hidden bg-sand">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageUrl(w.imageId, true)} alt={w.title ?? t("feed.imageAlt", { name: w.name })} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                        <span className="absolute top-3 left-3">
                          <RankBadge rank={w.rank} large />
                        </span>
                      </div>
                      <div className="p-4">
                        <p className="truncate text-[15px] font-semibold text-ink">{w.name}</p>
                        <p className="mt-1 flex items-center justify-between text-sm text-muted">
                          <span className="inline-flex items-center gap-1.5">
                            <Heart className="h-4 w-4 fill-rose text-rose" aria-hidden="true" />
                            {num(w.likes)}
                          </span>
                          <span className="font-semibold text-navy">{inr(w.prize)}</span>
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {c.description && (
            <section aria-labelledby="about-title">
              <h2 id="about-title" className="text-2xl font-semibold text-navy">
                {t("competition.about")}
              </h2>
              <p className="prose-text mt-3">{c.description}</p>
            </section>
          )}

          {rules.length > 0 && (
            <section aria-labelledby="rules-title">
              <h2 id="rules-title" className="text-2xl font-semibold text-navy">
                {t("competition.rules")}
              </h2>
              <ul className="mt-3 space-y-2">
                {rules.map((rule, i) => (
                  <li key={i} className="flex gap-3 text-[15px] text-ink/85">
                    <span className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-marigold" aria-hidden="true" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {phase !== "cancelled" && phase !== "upcoming" && (
            <section aria-labelledby="leaderboard-title">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="leaderboard-title" className="text-2xl font-semibold text-navy">
                  {t("competition.leaderboard")}
                </h2>
                <span className="text-xs font-semibold text-muted">
                  {phase === "open" ? t("competition.leaderboardLive") : phase === "results" ? t("competition.leaderboardFinal") : t("competition.leaderboardProvisional")}
                </span>
              </div>
              {leaderboard.length === 0 ? (
                <p className="mt-3 text-[15px] text-muted">{t("competition.leaderboardEmpty")}</p>
              ) : (
                <ol className="card mt-4 divide-y divide-line overflow-hidden">
                  {leaderboard.map((e, i) => (
                    <li key={e.id}>
                      <Link href={`/p/${e.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-sand/50">
                        <RankBadge rank={i + 1} />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageUrl(e.imageId, true)} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                        <Avatar name={e.userName} imageId={e.userImageId} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">{e.userName}</span>
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink tabular-nums">
                          {num(e.likes)}
                          <Heart className="h-4 w-4 fill-rose text-rose" aria-hidden="true" />
                          <span className="sr-only">{t("dashboard.likes")}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
              <p className="mt-2.5 text-xs text-muted">{t("competition.tieRule")}</p>
            </section>
          )}

          {phase !== "cancelled" && phase !== "upcoming" && (
            <section aria-labelledby="entries-title">
              <h2 id="entries-title" className="mb-4 text-2xl font-semibold text-navy">
                {t("competition.entriesTitle")}
              </h2>
              {rows.length ? (
                <Feed initialItems={rows.slice(0, PAGE_SIZE)} initialHasMore={rows.length > PAGE_SIZE} competitionId={id} narrow />
              ) : (
                <EmptyState title={t("competition.entriesEmptyTitle")} text={t("competition.entriesEmptyText")} />
              )}
            </section>
          )}
        </div>
      </div>

      <SponsorStrip sponsors={sponsors} title={t("sponsors.title")} />
    </>
  );
}
