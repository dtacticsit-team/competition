import { NextResponse } from "next/server";
import { getLocale } from "@/lib/i18n";
import { listSubmissions, PAGE_SIZE } from "@/lib/queries";

export const dynamic = "force-dynamic";
const UUID_RE = /^[0-9a-f-]{36}$/i;

/** Paginated public feed used by the "Load more" button. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const offset = Math.min(Math.max(Number(params.get("offset")) || 0, 0), 100_000);
  const competitionId = params.get("competitionId") ?? undefined;
  if (competitionId && !UUID_RE.test(competitionId)) return NextResponse.json({ items: [], hasMore: false });
  const rows = await listSubmissions({ locale: await getLocale(), competitionId, offset, limit: PAGE_SIZE + 1 });
  return NextResponse.json({ items: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE });
}
