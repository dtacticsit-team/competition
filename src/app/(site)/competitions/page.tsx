import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ImageIcon, Users } from "lucide-react";
import { EmptyState } from "@/components/blocks";
import { StatusPill } from "@/components/brand";
import { getPhase, processLifecycle, type Phase } from "@/lib/competitions";
import { fmtDate, imageUrl, num } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { listPublicCompetitions } from "@/lib/queries";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("competition.listTitle"), description: t("competition.listText") };
}

const ORDER: Phase[] = ["open", "upcoming", "ended", "results"];

export default async function CompetitionsPage() {
  await processLifecycle();
  const { t, locale } = await getT();
  const now = new Date();
  const list = (await listPublicCompetitions())
    .map((x) => ({ ...x, phase: getPhase(x.c, now) }))
    .sort((a, b) => ORDER.indexOf(a.phase) - ORDER.indexOf(b.phase) || +b.c.startAt - +a.c.startAt);

  return (
    <div className="page pt-8 sm:pt-12">
      <h1 className="text-3xl font-semibold text-navy sm:text-4xl">{t("competition.listTitle")}</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-muted">{t("competition.listText")}</p>

      {list.length === 0 ? (
        <div className="mt-8">
          <EmptyState title={t("competition.listEmptyTitle")} text={t("competition.listEmptyText")} />
        </div>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map(({ c, phase, participants, entries }) => (
            <li key={c.id}>
              <Link href={`/competitions/${c.id}`} className="card group flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-navy/30">
                <div className="relative aspect-[16/9] overflow-hidden bg-navy-deep">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.bannerImageId ? imageUrl(c.bannerImageId, true) : "/images/kolam-hero.jpg"}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                  <span className="absolute top-3 left-3">
                    <StatusPill phase={phase} label={t(`status.${phase}`)} />
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="text-xl font-semibold text-navy">{c.title}</h2>
                  <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                    <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {fmtDate(c.startAt, locale)} – {fmtDate(c.endAt, locale)}
                  </p>
                  <div className="mt-auto flex gap-5 pt-4 text-sm font-medium text-ink/80">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-navy" aria-hidden="true" />
                      {num(participants)} {t(participants === 1 ? "competition.participantOne" : "competition.participants")}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <ImageIcon className="h-4 w-4 text-navy" aria-hidden="true" />
                      {num(entries)} {t(entries === 1 ? "competition.entryOne" : "competition.entries")}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
