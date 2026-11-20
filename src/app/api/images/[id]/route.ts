import sharp from "sharp";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { images } from "@/db/schema";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Serves stored images. Ids are never reused, so responses cache forever. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return new Response("Not found", { status: 404 });
  const thumb = new URL(req.url).searchParams.get("v") === "thumb";
  const [row] = await db
    .select({
      mime: images.mime,
      data: thumb ? sql<Buffer>`coalesce(thumb_bytes, bytes)` : sql<Buffer>`bytes`,
    })
    .from(images)
    .where(eq(images.id, id));
  if (!row) return new Response("Not found", { status: 404 });
  let data = row.data;
  let mime = row.mime;
  // Social crawlers handle JPEG most reliably, so link previews get a JPEG rendition.
  if (new URL(req.url).searchParams.get("v") === "og") {
    data = await sharp(row.data).resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    mime = "image/jpeg";
  }
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
