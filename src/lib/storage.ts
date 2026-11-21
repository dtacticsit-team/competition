import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { images } from "@/db/schema";

/**
 * Image storage. This is the single place images are written, so replacing
 * the Postgres-backed store with an object store (e.g. Cloudflare R2) only
 * touches this file and `src/app/api/images/[id]/route.ts`.
 */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Detect the real file type from magic bytes; never trust the client's MIME. */
function sniff(buf: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export const hasFile = (v: unknown): v is File => v instanceof File && v.size > 0;

/**
 * Validates, re-encodes (which also strips EXIF/GPS metadata) and stores an
 * upload plus a feed-sized thumbnail. Returns a translation key on failure.
 */
export async function saveImage(file: unknown, maxDim = 1600): Promise<{ id: string } | { error: string }> {
  if (!hasFile(file)) return { error: "errors.imageRequired" };
  if (file.size > MAX_IMAGE_BYTES) return { error: "errors.imageTooLarge" };
  const input = Buffer.from(await file.arrayBuffer());
  if (!sniff(input)) return { error: "errors.imageType" };
  try {
    const base = sharp(input, { failOn: "error", limitInputPixels: 80_000_000 }).rotate();
    const full = await base
      .clone()
      .resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer({ resolveWithObject: true });
    const thumb = await base
      .clone()
      .resize({ width: 720, height: 720, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 76 })
      .toBuffer();
    const [row] = await db
      .insert(images)
      .values({
        mime: "image/webp",
        bytes: full.data,
        thumbBytes: thumb,
        width: full.info.width,
        height: full.info.height,
        size: full.data.length,
      })
      .returning({ id: images.id });
    return { id: row.id };
  } catch {
    return { error: "errors.imageInvalid" };
  }
}

export async function deleteImage(id: string | null | undefined) {
  if (!id) return;
  try {
    await db.delete(images).where(eq(images.id, id));
  } catch {
    // Still referenced elsewhere; leave it in place.
  }
}
