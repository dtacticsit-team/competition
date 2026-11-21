import Link from "next/link";
import { ArrowRight, CalendarDays, Heart, Share2, Trophy, Upload, UserPlus } from "lucide-react";
import { EmptyState, SponsorStrip } from "@/components/blocks";
import { StatusPill } from "@/components/brand";
import { Countdown, Feed } from "@/components/feed";
import { getPhase } from "@/lib/competitions";
import { fmtDateTime, imageUrl } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { listPublicCompetitions, listSponsors, listSubmissions, PAGE_SIZE } from "@/lib/queries";

export default async function HomePage() {
  const { t, locale } = await getT();
  const [comps, rows, sponsors] = await Promise.all([
    listPublicCompetitions(),
    listSubmissions({ locale, limit: PAGE_SIZE + 1 }),
    listSponsors(),
  ]);
  const now = new Date();
  const withPhase = comps.map((x) => ({ ...x, phase: getPhase(x.c, now) }));
  const featured =
    withPhase.filter((x) => x.phase === "open").sort((a, b) => +a.c.endAt - +b.c.endAt)[0] ??
    withPhase.filter((x) => x.phase === "upcoming").sort((a, b) => +a.c.startAt - +b.c.startAt)[0] ??
    null;
  const c = featured?.c;
  const steps = [
    { icon: UserPlus, title: t("home.step1Title"), text: t("home.step1Text") },
    { icon: Upload, title: t("home.step2Title"), text: t("home.step2Text") },
    { icon: Share2, title: t("home.step3Title"), text: t("home.step3Text") },
    { icon: Heart, title: t("home.step4Title"), text: t("home.step4Text") },
  ];

  return (
    <>
      {/* Competition banner */}
      <section className="page pt-4 sm:pt-8">
        <div className="relative isolate overflow-hidden rounded-3xl bg-navy-deep text-white shadow-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={c?.bannerImageId ? imageUrl(c.bannerImageId) : "/images/kolam-hero.jpg"}
            alt=""
            fetchPriority="high"
            className="absolute inset-0 -z-10 h-full w-full object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-linear-to-t from-navy-deep via-navy-deep/85 to-navy-deep/40 sm:bg-linear-to-r sm:from-navy-deep sm:via-navy-deep/85 sm:to-navy-deep/10" />
          <div className="rise-in flex min-h-[20rem] flex-col justify-end gap-6 p-6 sm:min-h-[22rem] sm:p-10 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              {featured && c ? (
                <>
                  <StatusPill phase={featured.phase} label={t(`status.${featured.phase}`)} />
                  <h1 className="mt-4 text-3xl leading-tight font-semibold sm:text-5xl">{c.title}</h1>
                  <p className="mt-3 flex items-center gap-2 text-sm text-white/85">
                    <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      {fmtDateTime(c.startAt, locale)} – {fmtDateTime(c.endAt, locale)} {t("competition.ist")}
                    </span>
                  </p>
                  {c.description && <p className="mt-3 line-clamp-2 text-[15px] text-white/85">{c.description}</p>}
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link href={`/competitions/${c.id}`} className="btn btn-primary">
                      {featured.phase === "open" ? t("competition.registerSubmit") : t("home.viewCompetition")}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold tracking-[0.14em] text-gold-soft uppercase">{t("site.name")}</p>
                  <h1 className="mt-3 text-3xl leading-tight font-semibold sm:text-5xl">{t("home.heroEmptyTitle")}</h1>
                  <p className="mt-3 text-[15px] text-white/85">{t("home.heroEmptyText")}</p>
                  <div className="mt-6">
                    <Link href="/competitions" className="btn btn-primary">
                      {t("home.browseCompetitions")}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </>
              )}
            </div>
            {featured && c && (
              <div className="shrink-0 self-start rounded-2xl bg-navy-deep/70 p-4 backdrop-blur-sm lg:self-end">
              <Countdown
                targetIso={(featured.phase === "open" ? c.endAt : c.startAt).toISOString()}
                nowIso={now.toISOString()}
                label={featured.phase === "open" ? t("countdown.endsIn") : t("countdown.startsIn")}
              />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Kolam feed: the main focus of the page */}
      <section aria-labelledby="feed-title" className="page mt-10 sm:mt-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 id="feed-title" className="text-2xl font-semibold text-navy sm:text-3xl">
              {t("home.latestTitle")}
            </h2>
            <p className="mt-1 text-[15px] text-muted">{t("home.latestText")}</p>
          </div>
          <Link href="/competitions" className="hidden shrink-0 items-center gap-1.5 text-sm font-semibold text-navy hover:underline sm:inline-flex">
            <Trophy className="h-4 w-4" aria-hidden="true" />
            {t("nav.competitions")}
          </Link>
        </div>
        {rows.length ? (
          <Feed initialItems={rows.slice(0, PAGE_SIZE)} initialHasMore={rows.length > PAGE_SIZE} />
        ) : (
          <EmptyState title={t("home.emptyTitle")} text={t("home.emptyText")}>
            <Link href="/competitions" className="btn btn-navy">
              {t("home.browseCompetitions")}
            </Link>
          </EmptyState>
        )}
      </section>

      {/* How it works */}
      <section aria-labelledby="how-title" className="page mt-14">
        <h2 id="how-title" className="eyebrow">
          {t("home.howTitle")}
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3.5 rounded-2xl border border-line bg-paper/70 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-white">
                <s.icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[15px] font-semibold text-ink">
                  <span className="mr-1.5 text-saffron tabular-nums">{i + 1}.</span>
                  {s.title}
                </p>
                <p className="mt-0.5 text-sm text-muted">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <SponsorStrip sponsors={sponsors} title={t("sponsors.title")} />
    </>
  );
}
