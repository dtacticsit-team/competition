import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { saveSubmissionAction } from "@/app/actions/competition";
import { EmptyState, Field } from "@/components/blocks";
import { ActionForm, ImageInput } from "@/components/forms";
import { db } from "@/db";
import { competitions, registrations, submissions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { isOpen } from "@/lib/competitions";
import { fmtDateTime, imageUrl } from "@/lib/format";
import { getT } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

export default async function SubmitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireUser(`/competitions/${id}/submit`);
  const { t, locale } = await getT();
  const [c] = await db.select().from(competitions).where(eq(competitions.id, id));
  if (!c || c.status === "draft") notFound();

  const back = (
    <Link href={`/competitions/${id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:underline">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {c.title}
    </Link>
  );

  if (!isOpen(c)) {
    return (
      <div className="page max-w-2xl pt-8">
        {back}
        <div className="mt-6">
          <EmptyState title={t("submit.closedTitle")} text={t("submit.closedText")} />
        </div>
      </div>
    );
  }

  const [registration] = await db
    .select({ id: registrations.id })
    .from(registrations)
    .where(and(eq(registrations.userId, user.id), eq(registrations.competitionId, id)));
  if (!registration) redirect(`/competitions/${id}`);
  const [existing] = await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.userId, user.id), eq(submissions.competitionId, id)));

  return (
    <div className="page max-w-2xl pt-8">
      {back}
      <h1 className="mt-4 text-3xl font-semibold text-navy">{existing ? t("submit.titleEdit") : t("submit.titleNew")}</h1>
      <p className="mt-2 text-[15px] text-muted">{t("submit.intro", { date: `${fmtDateTime(c.endAt, locale)} ${t("competition.ist")}` })}</p>

      {(c.proofStartImageId || c.proofMidImageId || c.proofEndImageId) && (
        <div className="card mt-6 border-line bg-sand/30 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-navy">{t("submit.proofGuideTitle")}</h2>
          <p className="mt-1 text-xs text-muted">{t("submit.proofGuideHint")}</p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {c.proofStartImageId && (
              <div className="overflow-hidden rounded-xl border border-line bg-white">
                <div className="aspect-square bg-sand">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl(c.proofStartImageId, true)} alt={t("competition.proofStageStart")} className="h-full w-full object-cover" />
                </div>
                <div className="p-2 text-center">
                  <p className="text-xs font-semibold text-navy">{t("competition.proofStageStart")}</p>
                </div>
              </div>
            )}
            {c.proofMidImageId && (
              <div className="overflow-hidden rounded-xl border border-line bg-white">
                <div className="aspect-square bg-sand">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl(c.proofMidImageId, true)} alt={t("competition.proofStageMid")} className="h-full w-full object-cover" />
                </div>
                <div className="p-2 text-center">
                  <p className="text-xs font-semibold text-navy">{t("competition.proofStageMid")}</p>
                </div>
              </div>
            )}
            {c.proofEndImageId && (
              <div className="overflow-hidden rounded-xl border border-line bg-white">
                <div className="aspect-square bg-sand">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl(c.proofEndImageId, true)} alt={t("competition.proofStageEnd")} className="h-full w-full object-cover" />
                </div>
                <div className="p-2 text-center">
                  <p className="text-xs font-semibold text-navy">{t("competition.proofStageEnd")}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card mt-6 p-5 sm:p-7">
        <ActionForm
          action={saveSubmissionAction}
          className="space-y-5"
          buttons={[{ label: existing ? t("submit.saveChanges") : t("submit.publish"), className: "btn btn-primary w-full sm:w-auto" }]}
        >
          <input type="hidden" name="competitionId" value={id} />
          <ImageInput name="image" label={t("submit.imageLabel")} currentUrl={existing ? imageUrl(existing.imageId, true) : null} required />
          <Field label={`${t("submit.titleLabel")} (${t("common.optional")})`}>
            <input name="title" maxLength={120} defaultValue={existing?.title ?? ""} placeholder={t("submit.titlePlaceholder")} className="input" />
          </Field>
          <Field label={`${t("submit.descriptionLabel")} (${t("common.optional")})`}>
            <textarea name="description" maxLength={1000} rows={4} defaultValue={existing?.description ?? ""} placeholder={t("submit.descriptionPlaceholder")} className="input" />
          </Field>
        </ActionForm>
      </div>
    </div>
  );
}
