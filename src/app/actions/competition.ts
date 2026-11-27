"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { competitions, registrations, submissions } from "@/db/schema";
import { getAppId } from "@/lib/app-config";
import { requireUser } from "@/lib/auth";
import { isOpen } from "@/lib/competitions";
import type { FormState } from "@/lib/i18n-shared";
import { rateLimit } from "@/lib/rate-limit";
import { deleteImage, hasFile, saveImage } from "@/lib/storage";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "");
const isUuid = (v: string) => z.string().uuid().safeParse(v).success;
const shortId = () => BigInt(`0x${randomBytes(7).toString("hex")}`).toString(36).padStart(11, "0");

const entrySchema = z.object({
  title: z.string().trim().max(120, "errors.titleLong"),
  description: z.string().trim().max(1000, "errors.descriptionLong"),
});

/** Registration is open for the whole competition window, checked on the server clock. */
export async function registerForCompetitionAction(fd: FormData) {
  const appId = getAppId();
  const id = str(fd, "competitionId");
  if (!isUuid(id)) redirect("/competitions");
  const user = await requireUser(`/competitions/${id}`);
  const [c] = await db.select().from(competitions).where(and(eq(competitions.id, id), eq(competitions.appId, appId)));
  if (!c || !isOpen(c)) redirect(`/competitions/${id}`);
  await db.insert(registrations).values({ appId, userId: user.id, competitionId: id }).onConflictDoNothing();
  revalidatePath(`/competitions/${id}`);
  redirect(`/competitions/${id}/submit`);
}

/** Creates the participant's single entry, or edits/replaces it until the deadline. */
export async function saveSubmissionAction(_: FormState, fd: FormData): Promise<FormState> {
  const appId = getAppId();
  const competitionId = str(fd, "competitionId");
  if (!isUuid(competitionId)) return { error: "errors.generic" };
  const user = await requireUser(`/competitions/${competitionId}/submit`);
  if (!rateLimit(`submit:${user.id}`, 20, 10 * 60 * 1000)) return { error: "errors.rateLimited" };

  const parsed = entrySchema.safeParse({ title: str(fd, "title"), description: str(fd, "description") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "errors.generic" };
  const title = parsed.data.title || null;
  const description = parsed.data.description || null;

  const [c] = await db
    .select()
    .from(competitions)
    .where(and(eq(competitions.id, competitionId), eq(competitions.appId, appId)));
  if (!c || !isOpen(c)) return { error: "errors.competitionClosed" };
  const mine = and(
    eq(registrations.userId, user.id),
    eq(registrations.competitionId, competitionId),
    eq(registrations.appId, appId),
  );
  const [registration] = await db.select({ id: registrations.id }).from(registrations).where(mine);
  if (!registration) return { error: "errors.notRegistered" };

  const [existing] = await db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.userId, user.id),
        eq(submissions.competitionId, competitionId),
        eq(submissions.appId, appId),
      ),
    );
  const file = fd.get("image");
  let postId: string;

  if (existing) {
    let imageId = existing.imageId;
    if (hasFile(file)) {
      const saved = await saveImage(file);
      if ("error" in saved) return saved;
      imageId = saved.id;
    }
    // Image processing takes time; the deadline is re-checked before writing.
    if (!isOpen(c)) {
      if (imageId !== existing.imageId) await deleteImage(imageId);
      return { error: "errors.competitionClosed" };
    }
    await db.update(submissions).set({ title, description, imageId, updatedAt: new Date() }).where(eq(submissions.id, existing.id));
    if (imageId !== existing.imageId) await deleteImage(existing.imageId);
    postId = existing.id;
  } else {
    const saved = await saveImage(file);
    if ("error" in saved) return saved;
    if (!isOpen(c)) {
      await deleteImage(saved.id);
      return { error: "errors.competitionClosed" };
    }
    postId = shortId();
    try {
      await db.insert(submissions).values({ appId, id: postId, userId: user.id, competitionId, imageId: saved.id, title, description });
    } catch {
      // The unique (user, competition) index rejected a duplicate entry.
      await deleteImage(saved.id);
      return { error: "errors.alreadySubmitted" };
    }
  }
  revalidatePath("/", "layout");
  redirect(`/p/${postId}`);
}
