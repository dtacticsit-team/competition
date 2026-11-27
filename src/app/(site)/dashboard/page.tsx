import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { BadgeCheck, Heart, MailWarning } from "lucide-react";
import { resendVerificationAction, updateProfileAction } from "@/app/actions/auth";
import { EmptyState, Field, RankBadge } from "@/components/blocks";
import { Avatar, StatusPill } from "@/components/brand";
import { ActionForm, ImageInput } from "@/components/forms";
import { db } from "@/db";
import { competitions, registrations, submissions, winners } from "@/db/schema";
import { getAppId } from "@/lib/app-config";
import { requireUser } from "@/lib/auth";
import { eligibleLikes, getPhase, processLifecycle } from "@/lib/competitions";
import { fmtDateTime, imageUrl, inr, num } from "@/lib/format";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("dashboard.title"), robots: { index: false } };
}

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  await processLifecycle();
  const { t, locale } = await getT();
  const appId = getAppId();
  const rows = await db
    .select({
      c: competitions,
      submissionId: submissions.id,
      imageId: submissions.imageId,
      entryTitle: submissions.title,
      likes: eligibleLikes,
      rank: winners.rank,
      prize: winners.prizeAmount,
    })
    .from(registrations)
    .innerJoin(competitions, eq(competitions.id, registrations.competitionId))
    .leftJoin(submissions, and(eq(submissions.competitionId, registrations.competitionId), eq(submissions.userId, registrations.userId)))
    .leftJoin(winners, and(eq(winners.submissionId, submissions.id), isNotNull(winners.publishedAt)))
    .where(and(eq(registrations.userId, user.id), eq(registrations.appId, appId), eq(competitions.appId, appId)))
    .orderBy(desc(registrations.registeredAt));
  const now = new Date();

  return (
    <div className="page pt-8 sm:pt-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={user.name} imageId={user.profileImageId} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold text-navy sm:text-3xl">{t("dashboard.greeting", { name: user.name })}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
              {user.username && <span className="font-semibold text-navy">@{user.username}</span>}
              <span className="truncate">{user.email}</span>
              {user.emailVerifiedAt && (
                <span className="inline-flex items-center gap-1 font-medium text-leaf">
                  <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                  {t("dashboard.verifiedBadge")}
                </span>
              )}
            </p>
          </div>
        </div>
        {user.username && (
          <Link href={`/u/${user.username}`} className="btn btn-outline btn-sm self-start sm:self-center">
            {t("dashboard.viewPublicProfile")}
          </Link>
        )}
      </div>

      {!user.emailVerifiedAt && (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-gold-soft/70 bg-gold-soft/15 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden="true" />
            <div>
              <p className="text-[15px] font-semibold text-ink">{t("dashboard.verifyTitle")}</p>
              <p className="text-sm text-muted">{t("dashboard.verifyText", { email: user.email })}</p>
            </div>
          </div>
          <ActionForm action={resendVerificationAction} className="space-y-2" buttonsClassName="flex" buttons={[{ label: t("dashboard.resend"), className: "btn btn-outline btn-sm" }]}>
            <></>
          </ActionForm>
        </div>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="my-competitions">
          <h2 id="my-competitions" className="text-2xl font-semibold text-navy">
            {t("dashboard.myCompetitions")}
          </h2>
          {rows.length === 0 ? (
            <div className="mt-4">
              <EmptyState title={t("dashboard.noneTitle")} text={t("dashboard.noneText")}>
                <Link href="/competitions" className="btn btn-primary">
                  {t("home.browseCompetitions")}
                </Link>
              </EmptyState>
            </div>
          ) : (
            <ul className="mt-4 space-y-4">
              {rows.map((r) => {
                const phase = getPhase(r.c, now);
                return (
                  <li key={r.c.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                    {r.submissionId && r.imageId ? (
                      <Link href={`/p/${r.submissionId}`} className="block h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-sand">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageUrl(r.imageId, true)} alt={r.entryTitle ?? t("dashboard.myEntry")} loading="lazy" className="h-full w-full object-cover" />
                      </Link>
                    ) : (
                      <div className="kolam-dots flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-dashed border-line px-2 text-center text-xs text-muted">
                        {t("dashboard.noEntry")}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/competitions/${r.c.id}`} className="text-lg font-semibold text-navy hover:underline">
                          {r.c.title}
                        </Link>
                        <StatusPill phase={phase} label={t(`status.${phase}`)} />
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {t("competition.ends")}: {fmtDateTime(r.c.endAt, locale)} {t("competition.ist")}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                        {r.submissionId && (
                          <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                            <Heart className="h-4 w-4 fill-rose text-rose" aria-hidden="true" />
                            {num(r.likes)} {t(r.likes === 1 ? "dashboard.likeOne" : "dashboard.likes")}
                          </span>
                        )}
                        {phase === "results" && r.rank && (
                          <span className="inline-flex items-center gap-2 font-semibold text-gold">
                            <RankBadge rank={r.rank} />
                            {t("dashboard.resultRank", { rank: r.rank })} · {inr(r.prize ?? 0)}
                          </span>
                        )}
                        {phase === "results" && !r.rank && <span className="text-muted">{t("dashboard.resultNone")}</span>}
                        {phase === "ended" && <span className="text-muted">{t("dashboard.resultPending")}</span>}
                      </div>
                    </div>
                    {phase === "open" && (
                      <Link href={`/competitions/${r.c.id}/submit`} className={`btn btn-sm shrink-0 ${r.submissionId ? "btn-outline" : "btn-primary"}`}>
                        {r.submissionId ? t("competition.editEntry") : t("competition.uploadKolam")}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="profile-title">
          <h2 id="profile-title" className="text-2xl font-semibold text-navy">
            {t("dashboard.profileTitle")}
          </h2>
          <div className="card mt-4 p-5">
            <ActionForm action={updateProfileAction} buttons={[{ label: t("common.save"), className: "btn btn-navy" }]}>
              <ImageInput name="image" label={t("dashboard.photo")} currentUrl={user.profileImageId ? imageUrl(user.profileImageId, true) : null} shape="avatar" />
              <Field label={t("auth.name")}>
                <input name="name" defaultValue={user.name} required maxLength={80} autoComplete="name" className="input" />
              </Field>
              <Field label={t("dashboard.username")} hint={t("dashboard.usernameHint")}>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm font-semibold text-muted">@</span>
                  <input
                    name="username"
                    defaultValue={user.username}
                    required
                    minLength={3}
                    maxLength={24}
                    pattern="[a-z0-9_]{3,24}"
                    autoComplete="username"
                    className="input pl-8 lowercase"
                  />
                </div>
              </Field>
              <Field label={t("dashboard.bio")} hint={t("dashboard.bioHint")}>
                <textarea
                  name="bio"
                  rows={3}
                  maxLength={300}
                  defaultValue={user.bio ?? ""}
                  placeholder={t("dashboard.bioPlaceholder")}
                  className="input"
                />
              </Field>
              <Field label={t("auth.phone")}>
                <input name="phone" type="tel" defaultValue={user.phone} required autoComplete="tel" className="input" />
              </Field>
            </ActionForm>
          </div>
        </section>
      </div>
    </div>
  );
}
