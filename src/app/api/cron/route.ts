import { NextResponse } from "next/server";
import { processLifecycle } from "@/lib/competitions";

export const dynamic = "force-dynamic";

/**
 * Optional external trigger for the lifecycle job (e.g. system cron calling
 * `curl -H "Authorization: Bearer $CRON_SECRET" https://site/api/cron`).
 * Disabled unless CRON_SECRET is set; the in-process scheduler runs regardless.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new NextResponse("Not found", { status: 404 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  const finalized = await processLifecycle();
  return NextResponse.json({ ok: true, finalized });
}
