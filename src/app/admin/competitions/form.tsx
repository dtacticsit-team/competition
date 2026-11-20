import Link from "next/link";
import { ArrowLeft, CircleCheck } from "lucide-react";
import { saveCompetitionAction } from "@/app/actions/admin";
import { Field } from "@/components/blocks";
import { ActionForm, ImageInput } from "@/components/forms";
import type { Competition } from "@/lib/competitions";
import { imageUrl, toIstLocalInput } from "@/lib/format";
import { getT } from "@/lib/i18n";

/** Single simple create/edit form (the reference's "Competition Setup" panel). */
export async function CompetitionForm({ c }: { c?: Competition }) {
  const { t } = await getT();
  const locked = !!c && (c.status === "cancelled" || !!c.finalizedAt);
  const published = c?.status === "published";
  const buttons = published
    ? [{ label: t("compForm.saveChanges"), name: "intent", value: "save", className: "btn btn-navy" }]
    : [
        { label: t("compForm.saveDraft"), name: "intent", value: "save", className: "btn btn-outline" },
        { label: t("compForm.publish"), name: "intent", value: "publish", className: "btn btn-navy" },
      ];

  return (
    <div className="max-w-3xl">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("admin.dashboard")}
      </Link>
      <h1 className="mt-3 text-3xl font-semibold text-navy">{c ? t("compForm.editTitle") : t("compForm.newTitle")}</h1>

      <p className="mt-5 flex items-start gap-2.5 rounded-2xl border border-leaf/20 bg-leaf-soft px-4 py-3 text-sm font-medium text-leaf">
        <CircleCheck className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden="true" />
        <span>{t("compForm.lifecycleNote")}</span>
      </p>

      {locked ? (
        <p className="card mt-6 p-5 text-[15px] text-muted">{t("errors.competitionLocked")}</p>
      ) : (
        <div className="card mt-6 p-5 sm:p-7">
          <ActionForm action={saveCompetitionAction} className="space-y-5" buttons={buttons} buttonsClassName="flex flex-wrap justify-end gap-3 border-t border-line pt-5">
            {c && <input type="hidden" name="id" value={c.id} />}
            <Field label={t("compForm.title")}>
              <input name="title" required minLength={3} maxLength={140} defaultValue={c?.title ?? ""} className="input" />
            </Field>
            <Field label={`${t("compForm.description")} (${t("common.optional")})`}>
              <textarea name="description" rows={4} maxLength={5000} defaultValue={c?.description ?? ""} className="input" />
            </Field>
            <ImageInput name="banner" label={`${t("compForm.banner")} (${t("common.optional")})`} currentUrl={c?.bannerImageId ? imageUrl(c.bannerImageId, true) : null} shape="wide" />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t("compForm.start")} hint={t("compForm.istHint")}>
                <input name="startAt" type="datetime-local" required defaultValue={c ? toIstLocalInput(c.startAt) : ""} className="input" />
              </Field>
              <Field label={t("compForm.end")} hint={t("compForm.istHint")}>
                <input name="endAt" type="datetime-local" required defaultValue={c ? toIstLocalInput(c.endAt) : ""} className="input" />
              </Field>
            </div>
            <Field label={`${t("compForm.rules")} (${t("common.optional")})`} hint={t("compForm.rulesHint")}>
              <textarea name="rules" rows={5} maxLength={5000} defaultValue={c?.rules ?? ""} className="input" />
            </Field>
            <Field label={`${t("compForm.prizeInfo")} (${t("common.optional")})`} hint={t("compForm.prizeInfoHint")}>
              <textarea name="prizeInfo" rows={2} maxLength={1000} defaultValue={c?.prizeInfo ?? ""} className="input" />
            </Field>
          </ActionForm>
        </div>
      )}
    </div>
  );
}
