import { and, asc, desc, eq, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, competitions, prizeConfiguration, submissions, winners } from "@/db/schema";

export type Competition = typeof competitions.$inferSelect;
export type Phase = "draft" | "cancelled" | "upcoming" | "open" | "ended" | "results";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Timing = Pick<Competition, "status" | "startAt" | "endAt" | "resultsPublishedAt">;

/**
 * The competition timestamps are the single source of truth. Registration,
 * submission and voting are all open exactly while `startAt <= now < endAt`
 * on the server clock; there is no separate flag that could drift.
 */
export function getPhase(c: Timing, now = new Date()): Phase {
  if (c.status === "draft") return "draft";
  if (c.status === "cancelled") return "cancelled";
  if (c.resultsPublishedAt) return "results";
  if (now < c.startAt) return "upcoming";
  if (now < c.endAt) return "open";
  return "ended";
}

export const isOpen = (c: Pick<Competition, "status" | "startAt" | "endAt">, now = new Date()) =>
  c.status === "published" && now >= c.startAt && now < c.endAt;

export async function getPrizes() {
  const [row] = await db.select().from(prizeConfiguration).where(eq(prizeConfiguration.id, 1));
  return {
    first: row?.firstPrize ?? 5000,
    second: row?.secondPrize ?? 3000,
    third: row?.thirdPrize ?? 1000,
  };
}

export async function audit(
  actorId: string | null,
  action: string,
  entity?: string,
  entityId?: string,
  meta?: Record<string, unknown>,
) {
  await db.insert(auditLogs).values({ actorId, action, entity, entityId, meta });
}

/** Eligible likes for the row of `submissions` in the enclosing query. */
export const eligibleLikes = sql<number>`(select count(*)::int from votes v where v.submission_id = "submissions"."id" and v.eligible)`;

/**
 * Ranks by eligible likes; ties go to the earlier submission. Replaces any
 * unpublished winner rows, so running it twice yields the same result.
 */
async function computeWinners(tx: Tx, competitionId: string) {
  const top = await tx
    .select({ id: submissions.id, userId: submissions.userId, likes: eligibleLikes })
    .from(submissions)
    .where(eq(submissions.competitionId, competitionId))
    .orderBy(desc(eligibleLikes), asc(submissions.submittedAt), asc(submissions.id))
    .limit(3);
  const [cfg] = await tx.select().from(prizeConfiguration).where(eq(prizeConfiguration.id, 1));
  const amounts = [cfg?.firstPrize ?? 5000, cfg?.secondPrize ?? 3000, cfg?.thirdPrize ?? 1000];
  await tx.delete(winners).where(eq(winners.competitionId, competitionId));
  if (top.length) {
    await tx.insert(winners).values(
      top.map((s, i) => ({
        competitionId,
        userId: s.userId,
        submissionId: s.id,
        rank: i + 1,
        finalLikes: s.likes,
        prizeAmount: amounts[i],
      })),
    );
  }
  return top.length;
}

/** Closes one ended competition. Row-locked and guarded, so it is idempotent. */
export async function finalizeCompetition(id: string) {
  await db.transaction(async (tx) => {
    const [c] = await tx.select().from(competitions).where(eq(competitions.id, id)).for("update");
    if (!c || c.status !== "published" || c.finalizedAt || c.endAt > new Date()) return;
    const count = await computeWinners(tx, id);
    await tx.update(competitions).set({ status: "closed", finalizedAt: new Date() }).where(eq(competitions.id, id));
    await tx
      .insert(auditLogs)
      .values({ actorId: null, action: "competition.finalized", entity: "competition", entityId: id, meta: { winners: count } });
  });
}

/** Re-rank after vote moderation. Only allowed until results are published. */
export async function recalculateWinners(id: string) {
  await db.transaction(async (tx) => {
    const [c] = await tx.select().from(competitions).where(eq(competitions.id, id)).for("update");
    if (!c || !c.finalizedAt || c.resultsPublishedAt) return;
    await computeWinners(tx, id);
  });
}

/** Scheduler entrypoint: finalize every published competition past its deadline. */
export async function processLifecycle() {
  const due = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(and(eq(competitions.status, "published"), isNull(competitions.finalizedAt), lte(competitions.endAt, new Date())));
  for (const c of due) await finalizeCompetition(c.id);
  return due.length;
}
