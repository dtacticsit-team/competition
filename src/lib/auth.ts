import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { isHttps } from "./request";

const SESSION_COOKIE = "kolam_session";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

const derive = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key))),
  );

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await derive(password, Buffer.from(saltHex, "hex"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  profileImageId: string | null;
  emailVerifiedAt: Date | null;
};

/** Only a hash of the session token is stored, so a DB leak can't be replayed. */
export async function createSession(userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await db.insert(sessions).values({ tokenHash: sha256(token), userId, expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await isHttps(),
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  store.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      profileImageId: users.profileImageId,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
});

export async function requireUser(next: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** Role is re-read from the database on every request; never trusted from the client. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (user.role !== "admin") notFound();
  return user;
}

/**
 * Admin bootstrap: emails listed in ADMIN_EMAILS become admins. When that
 * variable is unset, the very first account created becomes the admin.
 */
export async function shouldBeAdmin(email: string) {
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (list.length) return list.includes(email);
  const existing = await db.$count(users);
  return existing === 0;
}

/** Only allow same-site relative redirects. */
export const safeNext = (next: unknown, fallback = "/dashboard") =>
  typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : fallback;
