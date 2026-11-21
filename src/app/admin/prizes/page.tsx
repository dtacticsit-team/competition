import { savePrizesAction } from "@/app/actions/admin";
import { RankBadge } from "@/components/blocks";
import { ActionForm } from "@/components/forms";
import { getPrizes } from "@/lib/competitions";
import { getT } from "@/lib/i18n";

export default async function PrizesPage() {
  const [{ t }, prizes] = await Promise.all([getT(), getPrizes()]);
  const fields = [
    { name: "firstPrize", label: t("competition.prizeFirst"), value: prizes.first },
    { name: "secondPrize", label: t("competition.prizeSecond"), value: prizes.second },
    { name: "thirdPrize", label: t("competition.prizeThird"), value: prizes.third },
  ];
  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-semibold text-navy">{t("admin.prizes")}</h1>
      <p className="mt-2 text-[15px] text-muted">{t("prizesPage.text")}</p>
      <div className="card mt-8 p-5 sm:p-7">
        <ActionForm action={savePrizesAction} className="space-y-5" buttons={[{ label: t("common.save"), className: "btn btn-navy" }]}>
          {fields.map((f, i) => (
            <label key={f.name} className="flex items-center gap-4">
              <RankBadge rank={i + 1} large />
              <span className="w-28 shrink-0 text-[15px] font-medium text-ink sm:w-36">{f.label}</span>
              <span className="relative flex-1">
                <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-semibold text-muted" aria-hidden="true">
                  ₹
                </span>
                <input name={f.name} type="number" inputMode="numeric" min={0} step={1} required defaultValue={f.value} className="input pl-8 tabular-nums" />
              </span>
            </label>
          ))}
        </ActionForm>
      </div>
    </div>
  );
}
