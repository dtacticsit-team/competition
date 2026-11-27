import { asc, eq } from "drizzle-orm";
import { ReferenceManager, type ReferenceItem } from "@/components/reference-manager";
import { db } from "@/db";
import { designReferences } from "@/db/schema";
import { getAppId } from "@/lib/app-config";
import { getT } from "@/lib/i18n";
import { isReferenceSection } from "@/lib/sections";

export default async function ReferencesPage() {
  const { t } = await getT();
  const appId = getAppId();
  const rows = await db
    .select({ id: designReferences.id, section: designReferences.section, imageId: designReferences.imageId, fileName: designReferences.fileName, note: designReferences.note })
    .from(designReferences)
    .where(eq(designReferences.appId, appId))
    .orderBy(asc(designReferences.createdAt));
  const items = rows.filter((r): r is ReferenceItem => isReferenceSection(r.section));
  const workflow = [t("refs.flow1"), t("refs.flow2"), t("refs.flow3"), t("refs.flow4")];

  return (
    <div>
      <h1 className="text-3xl font-semibold text-navy">{t("admin.references")}</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-muted">{t("refs.intro")}</p>

      <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {workflow.map((step, i) => (
          <li key={i} className="flex gap-3 rounded-2xl border border-line bg-paper/70 p-3.5 text-sm text-ink/85">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      <p className="mt-4 rounded-xl border border-gold-soft/70 bg-gold-soft/15 px-4 py-3 text-sm text-ink/85">{t("refs.guidanceOnly")}</p>

      <div className="mt-8">
        <ReferenceManager items={items} />
      </div>
    </div>
  );
}
