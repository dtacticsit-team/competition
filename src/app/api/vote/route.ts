import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { competitions, submissions, voteEvents, votes } from "@/db/schema";
import { isOpen } from "@/lib/competitions";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, getVisitorId, hashIp, isHttps, VISITOR_COOKIE } from "@/lib/request";

export const dynamic = "force-dynamic";

/**
 * Anonymous likes. Browser cookies cannot prove "one human, one vote", so this
 * layers reasonable defences instead: a unique (entry, visitor) index, per-IP
 * rate limiting, a per-IP cap per entry, automatic flagging for admin review,
 * and an append-only audit trail.
 */
const FLAG_AT = Number(process.env.VOTE_FLAG_THRESHOLD ?? 10); // likes per IP per entry / 24h before flagging
const IP_CAP = Number(process.env.VOTE_IP_CAP ?? 50); // hard stop per IP per entry / 24h
const DAY_MS = 24 * 60 * 60 * 1000;

const bodySchema = z.object({ submissionId: z.string().min(1).max(40), like: z.boolean() });
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

function sameOrigin(req: Request) {
  if (req.headers.get("sec-fetch-site") === "same-origin") return true;
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser client: no ambient cookies to abuse
  try {
    const host = new URL(origin).host;
    const allowed = [req.headers.get("x-forwarded-host"), req.headers.get("host")];
    if (process.env.NEXT_PUBLIC_SITE_URL) allowed.push(new URL(process.env.NEXT_PUBLIC_SITE_URL).host);
    return allowed.includes(host);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("forbidden", 403);
  const ipHash = hashIp(await getClientIp());
  if (!rateLimit(`vote:${ipHash}`, 30, 60_000)) return fail("rate", 429);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid", 400);
  const { submissionId, like } = parsed.data;

  const [entry] = await db
    .select({ status: competitions.status, startAt: competitions.startAt, endAt: competitions.endAt })
    .from(submissions)
    .innerJoin(competitions, eq(competitions.id, submissions.competitionId))
    .where(eq(submissions.id, submissionId));
  if (!entry) return fail("notfound", 404);
  // Voting freezes at the exact end timestamp, judged by the server clock.
  if (!isOpen(entry)) return fail("closed", 409);

  let visitorId = await getVisitorId();
  const isNewVisitor = !visitorId;
  if (!visitorId) visitorId = randomBytes(18).toString("base64url");
  const event = (action: string) => db.insert(voteEvents).values({ submissionId, voterId: visitorId, ipHash, action });

  if (like) {
    const [{ recent }] = await db
      .select({ recent: sql<number>`count(*)::int` })
      .from(votes)
      .where(and(eq(votes.submissionId, submissionId), eq(votes.ipHash, ipHash), gt(votes.createdAt, new Date(Date.now() - DAY_MS))));
    if (recent >= IP_CAP) {
      await event("blocked");
      return fail("limit", 429);
    }
    const suspicious = recent >= FLAG_AT;
    const inserted = await db
      .insert(votes)
      .values({ submissionId, voterId: visitorId, ipHash, suspicious })
      .onConflictDoNothing()
      .returning({ id: votes.id });
    if (inserted.length) await event(suspicious ? "flagged" : "like");
  } else {
    const removed = await db
      .delete(votes)
      .where(and(eq(votes.submissionId, submissionId), eq(votes.voterId, visitorId)))
      .returning({ id: votes.id });
    if (removed.length) await event("unlike");
  }

  // The count always comes from the votes table, never from the client.
  const [{ likes }] = await db
    .select({ likes: sql<number>`count(*)::int` })
    .from(votes)
    .where(and(eq(votes.submissionId, submissionId), eq(votes.eligible, true)));

  const res = NextResponse.json({ likes, liked: like });
  if (isNewVisitor) {
    res.cookies.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: await isHttps(),
      path: "/",
      maxAge: 400 * 24 * 60 * 60,
    });
  }
  return res;
}
