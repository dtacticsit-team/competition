import Link from "next/link";
import { deleteSponsorAction, saveSponsorAction } from "@/app/actions/admin";
import { EmptyState, Field } from "@/components/blocks";
import { ActionForm, ConfirmButton, ImageInput } from "@/components/forms";
import { imageUrl } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { listSponsors } from "@/lib/queries";

export default async function SponsorsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const [{ t }, list, sp] = await Promise.all([getT(), listSponsors(), searchParams]);
  const editing = list.find((s) => s.id === sp.edit);

  return (
    <div>
      <h1 className="text-3xl font-semibold text-navy">{t("admin.sponsors")}</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-muted">{t("sponsorsPage.text")}</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <section aria-label={t("admin.sponsors")}>
          {list.length === 0 ? (
            <EmptyState title={t("sponsorsPage.emptyTitle")} text={t("sponsorsPage.emptyText")} />
          ) : (
            <ul className="space-y-3">
              {list.map((s) => (
                <li key={s.id} className={`card flex items-center gap-4 p-4 ${editing?.id === s.id ? "border-navy/40" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl(s.imageId, true)} alt="" className="h-16 w-24 shrink-0 rounded-lg bg-white object-contain p-1" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-ink">{s.name}</p>
                    {s.description && <p className="line-clamp-2 text-sm text-muted">{s.description}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    <Link href={`/admin/sponsors?edit=${s.id}`} className="btn btn-outline btn-sm">
                      {t("common.edit")}
                    </Link>
                    <form action={deleteSponsorAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <ConfirmButton message={t("sponsorsPage.deleteConfirm", { name: s.name })} className="btn btn-danger btn-sm w-full">
                        {t("common.delete")}
                      </ConfirmButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Re-keyed so the form clears after a save and refills when editing another sponsor. */}
        <section key={`${editing?.id ?? "new"}-${list.length}`} className="card self-start p-5" aria-labelledby="sponsor-form-title">
          <h2 id="sponsor-form-title" className="text-xl font-semibold text-navy">
            {editing ? t("sponsorsPage.editTitle") : t("sponsorsPage.addTitle")}
          </h2>
          <div className="mt-4">
            <ActionForm action={saveSponsorAction} buttons={[{ label: editing ? t("common.save") : t("sponsorsPage.add"), className: "btn btn-navy" }]}>
              {editing && <input type="hidden" name="id" value={editing.id} />}
              <Field label={t("sponsorsPage.name")}>
                <input name="name" required minLength={2} maxLength={100} defaultValue={editing?.name ?? ""} className="input" />
              </Field>
              <Field label={`${t("sponsorsPage.description")} (${t("common.optional")})`}>
                <textarea name="description" rows={2} maxLength={300} defaultValue={editing?.description ?? ""} className="input" />
              </Field>
              <ImageInput name="image" label={t("sponsorsPage.image")} currentUrl={editing ? imageUrl(editing.imageId, true) : null} required shape="logo" />
            </ActionForm>
            {editing && (
              <Link href="/admin/sponsors" className="mt-3 inline-block text-sm font-semibold text-navy hover:underline">
                {t("common.cancel")}
              </Link>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
