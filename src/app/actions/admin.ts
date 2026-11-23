"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { competitions, designReferences, prizeConfiguration, sponsors, submissions, votes, winners } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { audit, processLifecycle, recalculateWinners } from "@/lib/competitions";
import { parseIstLocal } from "@/lib/format";
import type { FormState } from "@/lib/i18n-shared";
import { isReferenceSection } from "@/lib/sections";
import { deleteImage, hasFile, saveImage } from "@/lib/storage";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "");
const isUuid = (v: string) => z.string().uuid().safeParse(v).success;
const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "errors.generic";

/* ----------------------------- Competitions ----------------------------- */

const competitionSchema = z.object({
  title: z.string().trim().min(3, "errors.titleRequired").max(140, "errors.titleLong"),
  description: z.string().trim().max(5000, "errors.descriptionLong"),
  rules: z.string().trim().max(5000, "errors.descriptionLong"),
  prizeInfo: z.string().trim().max(1000, "errors.descriptionLong"),
});

export async function saveCompetitionAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  await processLifecycle(); // make sure an ended competition is locked before it can be edited
  const id = str(fd, "id");
  const publish = str(fd, "intent") === "publish";

  const parsed = competitionSchema.safeParse({
    title: str(fd, "title"),
    description: str(fd, "description"),
    rules: str(fd, "rules"),
    prizeInfo: str(fd, "prizeInfo"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const startAt = parseIstLocal(str(fd, "startAt"));
  const endAt = parseIstLocal(str(fd, "endAt"));
  if (!startAt || !endAt) return { error: "errors.dates" };
  if (endAt <= startAt) return { error: "errors.dateOrder" };

  let existing: typeof competitions.$inferSelect | undefined;
  if (id) {
    if (!isUuid(id)) return { error: "errors.generic" };
    [existing] = await db.select().from(competitions).where(eq(competitions.id, id));
    if (!existing) return { error: "errors.generic" };
    if (existing.status === "cancelled" || existing.finalizedAt) return { error: "errors.competitionLocked" };
  }
  const status = publish ? "published" : (existing?.status ?? "draft");
  if (status === "published" && endAt <= new Date()) return { error: "errors.endInPast" };

  let bannerImageId = existing?.bannerImageId ?? null;
  const file = fd.get("banner");
  if (hasFile(file)) {
    const saved = await saveImage(file, 2000);
    if ("error" in saved) return saved;
    bannerImageId = saved.id;
  }

  let proofStartImageId = existing?.proofStartImageId ?? null;
  const fileProofStart = fd.get("proofStart");
  if (hasFile(fileProofStart)) {
    const saved = await saveImage(fileProofStart, 1600);
    if ("error" in saved) return saved;
    proofStartImageId = saved.id;
  }

  let proofMidImageId = existing?.proofMidImageId ?? null;
  const fileProofMid = fd.get("proofMid");
  if (hasFile(fileProofMid)) {
    const saved = await saveImage(fileProofMid, 1600);
    if ("error" in saved) return saved;
    proofMidImageId = saved.id;
  }

  let proofEndImageId = existing?.proofEndImageId ?? null;
  const fileProofEnd = fd.get("proofEnd");
  if (hasFile(fileProofEnd)) {
    const saved = await saveImage(fileProofEnd, 1600);
    if ("error" in saved) return saved;
    proofEndImageId = saved.id;
  }

  const values = {
    ...parsed.data,
    startAt,
    endAt,
    status,
    bannerImageId,
    proofStartImageId,
    proofMidImageId,
    proofEndImageId,
    updatedAt: new Date(),
  };
  let savedId = existing?.id;
  if (existing) {
    await db.update(competitions).set(values).where(eq(competitions.id, existing.id));
    if (bannerImageId !== existing.bannerImageId) await deleteImage(existing.bannerImageId);
    if (proofStartImageId !== existing.proofStartImageId) await deleteImage(existing.proofStartImageId);
    if (proofMidImageId !== existing.proofMidImageId) await deleteImage(existing.proofMidImageId);
    if (proofEndImageId !== existing.proofEndImageId) await deleteImage(existing.proofEndImageId);
  } else {
    const [row] = await db.insert(competitions).values(values).returning({ id: competitions.id });
    savedId = row.id;
  }
  const action = !existing ? "competition.created" : publish && existing.status !== "published" ? "competition.published" : "competition.updated";
  await audit(admin.id, action, "competition", savedId, { status, startAt, endAt });
  revalidatePath("/", "layout");
  redirect("/admin");
}

export async function cancelCompetitionAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  if (!isUuid(id)) return;
  const [c] = await db.select().from(competitions).where(eq(competitions.id, id));
  if (!c || c.resultsPublishedAt || c.status === "cancelled") return;
  await db.update(competitions).set({ status: "cancelled", updatedAt: new Date() }).where(eq(competitions.id, id));
  await audit(admin.id, "competition.cancelled", "competition", id, { previousStatus: c.status });
  revalidatePath("/", "layout");
}

/** Final rankings stay private until an admin approves them here. */
export async function approveResultsAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  if (!isUuid(id)) return;
  await db.transaction(async (tx) => {
    const [c] = await tx.select().from(competitions).where(eq(competitions.id, id)).for("update");
    if (!c || !c.finalizedAt || c.resultsPublishedAt || c.status !== "closed") return;
    const now = new Date();
    await tx.update(winners).set({ publishedAt: now }).where(eq(winners.competitionId, id));
    await tx.update(competitions).set({ resultsPublishedAt: now, updatedAt: now }).where(eq(competitions.id, id));
  });
  await audit(admin.id, "results.approved", "competition", id);
  revalidatePath("/", "layout");
}

/** Vote moderation: exclude or restore the flagged likes of one entry. */
export async function setFlaggedVotesAction(fd: FormData) {
  const admin = await requireAdmin();
  const submissionId = str(fd, "submissionId");
  const eligible = str(fd, "eligible") === "true";
  const [row] = await db
    .select({ competitionId: submissions.competitionId, resultsPublishedAt: competitions.resultsPublishedAt })
    .from(submissions)
    .innerJoin(competitions, eq(competitions.id, submissions.competitionId))
    .where(eq(submissions.id, submissionId));
  if (!row || row.resultsPublishedAt) return;
  const changed = await db
    .update(votes)
    .set({ eligible })
    .where(and(eq(votes.submissionId, submissionId), eq(votes.suspicious, true)))
    .returning({ id: votes.id });
  await audit(admin.id, eligible ? "votes.restored" : "votes.excluded", "submission", submissionId, { votes: changed.length });
  await recalculateWinners(row.competitionId);
  revalidatePath("/", "layout");
}

/* ------------------------------- Sponsors ------------------------------- */

const sponsorSchema = z.object({
  name: z.string().trim().min(2, "errors.sponsorName").max(100, "errors.sponsorName"),
  description: z.string().trim().max(300, "errors.descriptionLong"),
});

export async function saveSponsorAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const parsed = sponsorSchema.safeParse({ name: str(fd, "name"), description: str(fd, "description") });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const name = parsed.data.name;
  const description = parsed.data.description || null;
  const file = fd.get("image");

  if (id) {
    if (!isUuid(id)) return { error: "errors.generic" };
    const [existing] = await db.select().from(sponsors).where(eq(sponsors.id, id));
    if (!existing) return { error: "errors.generic" };
    let imageId = existing.imageId;
    if (hasFile(file)) {
      const saved = await saveImage(file, 800);
      if ("error" in saved) return saved;
      imageId = saved.id;
    }
    await db.update(sponsors).set({ name, description, imageId, updatedAt: new Date() }).where(eq(sponsors.id, id));
    if (imageId !== existing.imageId) await deleteImage(existing.imageId);
    await audit(admin.id, "sponsor.updated", "sponsor", id);
  } else {
    const saved = await saveImage(file, 800);
    if ("error" in saved) return saved;
    const [row] = await db.insert(sponsors).values({ name, description, imageId: saved.id }).returning({ id: sponsors.id });
    await audit(admin.id, "sponsor.created", "sponsor", row.id);
  }
  revalidatePath("/", "layout");
  redirect("/admin/sponsors");
}

export async function deleteSponsorAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  if (!isUuid(id)) return;
  const [row] = await db.delete(sponsors).where(eq(sponsors.id, id)).returning({ imageId: sponsors.imageId });
  if (row) {
    await deleteImage(row.imageId);
    await audit(admin.id, "sponsor.deleted", "sponsor", id);
  }
  revalidatePath("/", "layout");
}

/* -------------------------------- Prizes -------------------------------- */

const amount = z.coerce.number("errors.prizeInvalid").int("errors.prizeInvalid").min(0, "errors.prizeInvalid").max(100_000_000, "errors.prizeInvalid");

export async function savePrizesAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ firstPrize: amount, secondPrize: amount, thirdPrize: amount })
    .safeParse({ firstPrize: str(fd, "firstPrize"), secondPrize: str(fd, "secondPrize"), thirdPrize: str(fd, "thirdPrize") });
  if (!parsed.success) return { error: "errors.prizeInvalid" };
  const values = { ...parsed.data, updatedAt: new Date() };
  await db.insert(prizeConfiguration).values({ id: 1, ...values }).onConflictDoUpdate({ target: prizeConfiguration.id, set: values });
  await audit(admin.id, "prizes.updated", "prize_configuration", "1", parsed.data);
  revalidatePath("/", "layout");
  return { ok: "admin.prizesSaved" };
}

/* --------------------------- Design references -------------------------- */

/** Upload one reference image, or replace an existing one when `replaceId` is set. */
export async function uploadReferenceAction(fd: FormData): Promise<{ ok: true } | { error: string }> {
  await requireAdmin();
  const section = str(fd, "section");
  const replaceId = str(fd, "replaceId");
  const file = fd.get("file");
  if (!isReferenceSection(section)) return { error: "errors.generic" };
  const saved = await saveImage(file, 2400);
  if ("error" in saved) return saved;
  const fileName = (hasFile(file) ? file.name : "reference").slice(0, 200);

  if (replaceId) {
    if (!isUuid(replaceId)) return { error: "errors.generic" };
    const [existing] = await db.select().from(designReferences).where(eq(designReferences.id, replaceId));
    if (!existing) {
      await deleteImage(saved.id);
      return { error: "errors.generic" };
    }
    await db.update(designReferences).set({ imageId: saved.id, fileName, updatedAt: new Date() }).where(eq(designReferences.id, replaceId));
    await deleteImage(existing.imageId);
  } else {
    await db.insert(designReferences).values({ section, imageId: saved.id, fileName });
  }
  revalidatePath("/admin/references");
  return { ok: true };
}

export async function updateReferenceAction(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const section = str(fd, "section");
  if (!isUuid(id) || !isReferenceSection(section)) return;
  const note = str(fd, "note").trim().slice(0, 500) || null;
  await db.update(designReferences).set({ section, note, updatedAt: new Date() }).where(eq(designReferences.id, id));
  revalidatePath("/admin/references");
}

export async function deleteReferenceAction(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  if (!isUuid(id)) return;
  const [row] = await db.delete(designReferences).where(eq(designReferences.id, id)).returning({ imageId: designReferences.imageId });
  if (row) await deleteImage(row.imageId);
  revalidatePath("/admin/references");
}
