import { cookies, headers } from "next/headers";
import { createHash } from "node:crypto";

export const VISITOR_COOKIE = "kolam_vid";
const VISITOR_RE = /^[A-Za-z0-9_-]{20,64}$/;

/** First hop of X-Forwarded-For. Deploy behind a proxy that sets this header. */
export async function getClientIp() {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : h.get("x-real-ip")) || "unknown";
}

/** IPs are never stored raw; only a salted hash is kept for abuse detection. */
export const hashIp = (ip: string) =>
  createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? "kolam"}:${ip}`)
    .digest("hex")
    .slice(0, 32);

export async function isHttps() {
  const h = await headers();
  return h.get("x-forwarded-proto")?.split(",")[0].trim() === "https";
}

export async function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const local = host.startsWith("localhost") || host.startsWith("127.");
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}

/** Anonymous first-party visitor id (httpOnly cookie issued by the vote API). */
export async function getVisitorId() {
  const value = (await cookies()).get(VISITOR_COOKIE)?.value;
  return value && VISITOR_RE.test(value) ? value : null;
}
