import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNotNull } from "drizzle-orm";
import { ArrowLeft, Pencil, Trophy } from "lucide-react";
import { Avatar } from "@/components/brand";
import { LikeButton, SharePanel } from "@/components/feed";
import { db } from "@/db";
import { submissions, winners } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { imageUrl } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { listSubmissions } from "@/lib/queries";
import { getBaseUrl } from "@/lib/request";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!/^[a-z0-9]{6,20}$/.test(id)) return null;
  const { locale } = await getT();
  const [item] = await listSubmissions({ locale, id, limit: 1 });
  return item ?? null;
}

/** Open Graph tags so WhatsApp / Facebook show the Kolam as a rich preview. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const item = await load(id);
  if (!item) return {};
  const { t } = await getT();
  const title = t("post.metaTitle", { title: item.title ?? t("post.entryFallbackTitle"), name: item.userName });
  const description = item.description?.slice(0, 180) || t("post.metaDescription", { name: item.userName, competition: item.competitionTitle });
  const image = `${imageUrl(item.imageId)}?v=og`;
  return {
    title,
    description,
    alternates: { canonical: `/p/${id}` },
    openGraph: { type: "article", title, description, url: `/p/${id}`, images: [{ url: image, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const item = await load(id);
  if (!item) notFound();
  const { t } = await getT();
  const [user, baseUrl, [owner], [win]] = await Promise.all([
    getCurrentUser(),
    getBaseUrl(),
    db.select({ userId: submissions.userId }).from(submissions).where(eq(submissions.id, id)),
    db.select({ rank: winners.rank }).from(winners).where(and(eq(winners.submissionId, id), isNotNull(winners.publishedAt))),
  ]);
  const url = `${baseUrl}/p/${id}`;
  const heading = item.title ?? t("post.entryFallbackTitle");
  const shareText = t("post.metaTitle", { title: heading, name: item.userName });

  return (
    <div className="page pt-5 sm:pt-8">
      <Link href={`/competitions/${item.competitionId}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {item.competitionTitle}
      </Link>

      <article className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-10">
        <div className="self-start overflow-hidden rounded-3xl border border-line bg-sand shadow-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl(item.imageId)}
            srcSet={`${imageUrl(item.imageId, true)} 720w, ${imageUrl(item.imageId)} 1600w`}
            sizes="(min-width: 1024px) 640px, 100vw"
            alt={t("feed.imageAlt", { name: item.userName })}
            fetchPriority="high"
            className="max-h-[80vh] w-full object-contain"
          />
        </div>

        <div className="lg:py-2">
          <div className="flex items-center gap-3">
            <Avatar name={item.userName} imageId={item.userImageId} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-ink">{item.userName}</p>
              <p className="text-sm text-muted">
                {t("post.participant")} · {item.dateLabel}
              </p>
            </div>
          </div>

          {win && (
            <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-gold-soft/30 px-3.5 py-1.5 text-sm font-semibold text-gold">
              <Trophy className="h-4 w-4" aria-hidden="true" />
              {t("post.winnerBadge", { rank: win.rank })}
            </p>
          )}

          <h1 className="mt-5 text-3xl leading-tight font-semibold text-navy sm:text-4xl">{heading}</h1>
          {item.description && <p className="prose-text mt-3">{item.description}</p>}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <LikeButton id={item.id} likes={item.likes} liked={item.liked} open={item.votingOpen} large />
            <span className={`text-sm font-medium ${item.votingOpen ? "text-leaf" : "text-muted"}`}>
              {item.votingOpen ? t("post.votingOpen") : t("post.votingClosed")}
            </span>
          </div>

          <div className="mt-8 border-t border-line pt-6">
            <h2 className="eyebrow mb-3">{t("post.shareTitle")}</h2>
            <SharePanel url={url} text={shareText} />
          </div>

          {user && owner?.userId === user.id && item.votingOpen && (
            <Link href={`/competitions/${item.competitionId}/submit`} className="btn btn-outline mt-6">
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {t("competition.editEntry")}
            </Link>
          )}
        </div>
      </article>
    </div>
  );
}
