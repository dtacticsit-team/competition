import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { competitions, sponsors, submissions, users } from "@/db/schema";
import { eligibleLikes, isOpen } from "./competitions";
import { fmtShort } from "./format";
import type { Locale } from "./i18n-shared";
import { getVisitorId } from "./request";

export const PAGE_SIZE = 12;
const PUBLIC_STATUSES = ["published", "closed"];

export type FeedItem = {
  id: string;
  title: string | null;
  description: string | null;
  imageId: string;
  dateLabel: string;
  userName: string;
  userImageId: string | null;
  competitionId: string;
  competitionTitle: string;
  likes: number;
  liked: boolean;
  votingOpen: boolean;
};

type ListOptions = {
  locale: Locale;
  competitionId?: string;
  id?: string;
  limit?: number;
  offset?: number;
  order?: "latest" | "top";
};

/** Public entries only (draft and cancelled competitions are excluded). */
export async function listSubmissions(o: ListOptions): Promise<FeedItem[]> {
  const visitorId = await getVisitorId();
  const liked = visitorId
    ? sql<boolean>`exists(select 1 from votes v2 where v2.submission_id = "submissions"."id" and v2.voter_id = ${visitorId})`
    : sql<boolean>`false`;
  const conds = [inArray(competitions.status, PUBLIC_STATUSES)];
  if (o.competitionId) conds.push(eq(submissions.competitionId, o.competitionId));
  if (o.id) conds.push(eq(submissions.id, o.id));
  const rows = await db
    .select({
      id: submissions.id,
      title: submissions.title,
      description: submissions.description,
      imageId: submissions.imageId,
      submittedAt: submissions.submittedAt,
      userName: users.name,
      userImageId: users.profileImageId,
      competitionId: competitions.id,
      competitionTitle: competitions.title,
      status: competitions.status,
      startAt: competitions.startAt,
      endAt: competitions.endAt,
      likes: eligibleLikes,
      liked,
    })
    .from(submissions)
    .innerJoin(users, eq(users.id, submissions.userId))
    .innerJoin(competitions, eq(competitions.id, submissions.competitionId))
    .where(and(...conds))
    .orderBy(
      ...(o.order === "top"
        ? [desc(eligibleLikes), asc(submissions.submittedAt), asc(submissions.id)]
        : [desc(submissions.submittedAt), desc(submissions.id)]),
    )
    .limit(o.limit ?? PAGE_SIZE)
    .offset(o.offset ?? 0);
  const now = new Date();
  return rows.map(({ status, startAt, endAt, submittedAt, ...r }) => ({
    ...r,
    dateLabel: fmtShort(submittedAt, o.locale),
    votingOpen: isOpen({ status, startAt, endAt }, now),
  }));
}

export async function listPublicCompetitions() {
  return db
    .select({
      c: competitions,
      participants: sql<number>`(select count(*)::int from registrations r where r.competition_id = "competitions"."id")`,
      entries: sql<number>`(select count(*)::int from submissions s where s.competition_id = "competitions"."id")`,
    })
    .from(competitions)
    .where(inArray(competitions.status, PUBLIC_STATUSES))
    .orderBy(desc(competitions.startAt));
}

export async function listSponsors() {
  return db
    .select({ id: sponsors.id, name: sponsors.name, description: sponsors.description, imageId: sponsors.imageId })
    .from(sponsors)
    .orderBy(asc(sponsors.createdAt));
}
