import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { Award, Calendar, Heart, ImageIcon, Pencil, Trophy } from "lucide-react";
import { EmptyState, RankBadge } from "@/components/blocks";
import { Avatar } from "@/components/brand";
import { db } from "@/db";
import { competitions, registrations, submissions, users, winners } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { fmtDate, imageUrl, inr, num } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { listSubmissions } from "@/lib/queries";
import { getBaseUrl } from "@/lib/request";

type Props = { params: Promise<{ username: string }> };

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;
const PUBLIC_STATUSES = ["published", "closed"];

async function loadCreator(username: string) {
  const normalized = username.trim().toLowerCase();
  if (!USERNAME_RE.test(normalized)) return null;

  const [creator] = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      bio: users.bio,
      profileImageId: users.profileImageId,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.username, normalized))
    .limit(1);

  return creator ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const creator = await loadCreator(username);
  if (!creator) return {};

  const { t } = await getT();
  const title = `${creator.name} (@${creator.username}) — ${t("site.name")}`;
  const description =
    creator.bio?.slice(0, 180) ||
    t("profile.metaDescription", { name: creator.name, username: creator.username });
  const image = creator.profileImageId ? `${imageUrl(creator.profileImageId)}?v=og` : "/images/kolam-hero.jpg";

  return {
    title,
    description,
    alternates: { canonical: `/u/${creator.username}` },
    openGraph: {
      type: "profile",
      title,
      description,
      url: `/u/${creator.username}`,
      images: [{ url: image, alt: creator.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  const creator = await loadCreator(username);
  if (!creator) notFound();

  const { t, locale } = await getT();
  const [currentUser, [stats], accolades, entries] = await Promise.all([
    getCurrentUser(),
    db
      .select({
        competitionsCount: sql<number>`(select count(*)::int from registrations r where r.user_id = ${creator.id})`,
        entriesCount: sql<number>`(select count(*)::int from submissions s inner join competitions c on c.id = s.competition_id where s.user_id = ${creator.id} and c.status in ('published', 'closed'))`,
      })
      .from(users)
      .where(eq(users.id, creator.id)),
    db
      .select({
        rank: winners.rank,
        prize: winners.prizeAmount,
        submissionId: winners.submissionId,
        competitionTitle: competitions.title,
      })
      .from(winners)
      .innerJoin(competitions, eq(competitions.id, winners.competitionId))
      .where(and(eq(winners.userId, creator.id), isNotNull(winners.publishedAt)))
      .orderBy(asc(winners.rank), desc(winners.publishedAt)),
    listSubmissions({ locale, userId: creator.id, limit: 60 }),
  ]);

  const isOwner = currentUser?.id === creator.id;

  return (
    <div className="page pt-6 sm:pt-10">
      {/* Creator Header Card */}
      <section aria-labelledby="creator-info" className="card relative overflow-hidden p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
          <div className="shrink-0 self-center sm:self-start">
            <Avatar name={creator.name} imageId={creator.profileImageId} size="2xl" />
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-navy sm:text-3xl">{creator.name}</h1>
                <p className="mt-0.5 text-base font-semibold text-saffron">@{creator.username}</p>
              </div>

              {isOwner && (
                <Link href="/dashboard" className="btn btn-outline btn-sm self-center sm:self-auto">
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  {t("profile.editProfile")}
                </Link>
              )}
            </div>

            {creator.bio ? (
              <p className="mt-3.5 max-w-2xl text-[15px] leading-relaxed text-ink/85 whitespace-pre-line">
                {creator.bio}
              </p>
            ) : (
              <p className="mt-3 text-sm italic text-muted">{t("profile.noBio")}</p>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-line/70 pt-4 text-sm text-muted sm:justify-start">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-navy/70" aria-hidden="true" />
                <span>{t("profile.joined", { date: fmtDate(creator.createdAt, locale) })}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4 text-navy/70" aria-hidden="true" />
                <span className="font-semibold text-ink tabular-nums">{num(stats?.entriesCount ?? 0)}</span>
                <span>{t(stats?.entriesCount === 1 ? "profile.postOne" : "profile.posts")}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Trophy className="h-4 w-4 text-navy/70" aria-hidden="true" />
                <span className="font-semibold text-ink tabular-nums">{num(stats?.competitionsCount ?? 0)}</span>
                <span>{t(stats?.competitionsCount === 1 ? "profile.competitionOne" : "profile.competitions")}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Accolades & Winner Badges */}
        {accolades.length > 0 && (
          <div className="mt-6 border-t border-line/70 pt-4">
            <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">
              {t("profile.awardsTitle")}
            </h2>
            <div className="mt-2.5 flex flex-wrap gap-2.5">
              {accolades.map((a, i) => (
                <Link
                  key={i}
                  href={`/p/${a.submissionId}`}
                  className="inline-flex items-center gap-2 rounded-full border border-gold-soft/80 bg-gold-soft/20 px-3 py-1 text-xs font-semibold text-ink transition hover:bg-gold-soft/35"
                >
                  <RankBadge rank={a.rank} />
                  <span className="truncate max-w-[12rem]">{a.competitionTitle}</span>
                  <span className="text-navy">{inr(a.prize)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Published Submissions Gallery */}
      <section aria-labelledby="gallery-title" className="mt-10 sm:mt-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 id="gallery-title" className="text-2xl font-semibold text-navy">
            {t("profile.galleryTitle")}
          </h2>
          <span className="text-sm font-medium text-muted">
            {num(entries.length)} {t(entries.length === 1 ? "profile.postOne" : "profile.posts")}
          </span>
        </div>

        {entries.length === 0 ? (
          <EmptyState title={t("profile.noPostsTitle")} text={t("profile.noPostsText")} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((item) => (
              <article key={item.id} className="card group flex flex-col overflow-hidden">
                <Link href={`/p/${item.id}`} className="block aspect-square overflow-hidden bg-sand">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl(item.imageId, true)}
                    srcSet={`${imageUrl(item.imageId, true)} 720w, ${imageUrl(item.imageId)} 1600w`}
                    sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                    alt={item.title ?? t("feed.imageAlt", { name: creator.name })}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.03]"
                  />
                </Link>
                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    {item.title ? (
                      <h3 className="line-clamp-1 font-sans text-[15px] font-semibold text-ink group-hover:text-navy">
                        <Link href={`/p/${item.id}`}>{item.title}</Link>
                      </h3>
                    ) : (
                      <p className="text-xs text-muted">
                        <Link href={`/competitions/${item.competitionId}`} className="hover:underline">
                          {item.competitionTitle}
                        </Link>
                      </p>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-line/60 text-xs font-medium text-muted">
                    <span className="truncate max-w-[12rem]">{item.competitionTitle}</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-ink">
                      <Heart className="h-3.5 w-3.5 fill-rose text-rose" aria-hidden="true" />
                      {num(item.likes)}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
