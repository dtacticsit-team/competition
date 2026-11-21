"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { authTokens, sessions, users } from "@/db/schema";
import {
  createSession,
  destroySession,
  hashPassword,
  newToken,
  requireUser,
  safeNext,
  sha256,
  shouldBeAdmin,
  verifyPassword,
} from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { LOCALE_COOKIE, type FormState } from "@/lib/i18n-shared";
import { sendMail } from "@/lib/mail";
import { rateLimit } from "@/lib/rate-limit";
import { getBaseUrl, getClientIp } from "@/lib/request";
import { deleteImage, hasFile, saveImage } from "@/lib/storage";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "");
const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "errors.generic";

const nameSchema = z.string().trim().min(2, "errors.name").max(80, "errors.name");
const emailSchema = z.string().trim().toLowerCase().email("errors.email").max(200, "errors.email");
const phoneSchema = z.string().trim().regex(/^\+?[0-9][0-9\s-]{8,16}$/, "errors.phone");
const passwordSchema = z.string().min(8, "errors.passwordShort").max(200, "errors.passwordShort");

const registerSchema = z
  .object({ name: nameSchema, email: emailSchema, phone: phoneSchema, password: passwordSchema, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "errors.passwordMismatch" });

async function issueToken(userId: string, type: "verify" | "reset", ttlMs: number) {
  const token = newToken();
  await db.insert(authTokens).values({ userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs) });
  return token;
}

async function sendVerification(userId: string, email: string) {
  const { t } = await getT();
  const token = await issueToken(userId, "verify", 48 * 60 * 60 * 1000);
  const link = `${await getBaseUrl()}/verify-email?token=${token}`;
  await sendMail(email, t("mail.verifySubject"), t("mail.verifyBody", { link }));
}

export async function registerAction(_: FormState, fd: FormData): Promise<FormState> {
  // Generous enough for a family or community group sharing one connection.
  if (!rateLimit(`register:${await getClientIp()}`, 30, 60 * 60 * 1000)) return { error: "errors.rateLimited" };
  const parsed = registerSchema.safeParse({
    name: str(fd, "name"),
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    password: str(fd, "password"),
    confirm: str(fd, "confirm"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { name, email, phone, password } = parsed.data;

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) return { error: "errors.emailTaken" };

  const role = (await shouldBeAdmin(email)) ? "admin" : "user";
  let userId: string;
  try {
    const [row] = await db
      .insert(users)
      .values({ name, email, phone, role, passwordHash: await hashPassword(password) })
      .returning({ id: users.id });
    userId = row.id;
  } catch {
    return { error: "errors.emailTaken" }; // lost a race on the unique email index
  }
  await createSession(userId);
  await sendVerification(userId, email);
  redirect(safeNext(fd.get("next"), role === "admin" ? "/admin" : "/dashboard"));
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").trim().toLowerCase();
  const password = str(fd, "password");
  const ip = await getClientIp();
  const window = 10 * 60 * 1000;
  if (!rateLimit(`login:ip:${ip}`, 20, window) || !rateLimit(`login:email:${email}`, 8, window)) {
    return { error: "errors.rateLimited" };
  }
  const [user] = await db.select().from(users).where(eq(users.email, email));
  // Hash even when the account is unknown so response time doesn't reveal it.
  const valid = user ? await verifyPassword(password, user.passwordHash) : (await hashPassword(password), false);
  if (!user || !valid) return { error: "errors.invalidCredentials" };

  let role = user.role;
  if (role !== "admin" && process.env.ADMIN_EMAILS && (await shouldBeAdmin(email))) {
    await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
    role = "admin";
  }
  await createSession(user.id);
  redirect(safeNext(fd.get("next"), role === "admin" ? "/admin" : "/dashboard"));
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function forgotPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  if (!rateLimit(`forgot:${await getClientIp()}`, 5, 15 * 60 * 1000)) return { error: "errors.rateLimited" };
  const parsed = emailSchema.safeParse(str(fd, "email"));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const [user] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, parsed.data));
  if (user) {
    const { t } = await getT();
    const token = await issueToken(user.id, "reset", 60 * 60 * 1000);
    const link = `${await getBaseUrl()}/reset-password?token=${token}`;
    await sendMail(user.email, t("mail.resetSubject"), t("mail.resetBody", { link }));
  }
  // Same answer either way, so this form can't be used to probe for accounts.
  return { ok: "auth.resetSent" };
}

export async function resetPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  if (!rateLimit(`reset:${await getClientIp()}`, 10, 15 * 60 * 1000)) return { error: "errors.rateLimited" };
  const parsed = passwordSchema.safeParse(str(fd, "password"));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (parsed.data !== str(fd, "confirm")) return { error: "errors.passwordMismatch" };

  const [token] = await db
    .select()
    .from(authTokens)
    .where(
      and(
        eq(authTokens.tokenHash, sha256(str(fd, "token"))),
        eq(authTokens.type, "reset"),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, new Date()),
      ),
    );
  if (!token) return { error: "errors.tokenInvalid" };

  const passwordHash = await hashPassword(parsed.data);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, token.userId));
    await tx.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, token.id));
    await tx.delete(sessions).where(eq(sessions.userId, token.userId)); // sign out everywhere
  });
  redirect("/login?reset=1");
}

export async function resendVerificationAction(_: FormState, _fd: FormData): Promise<FormState> {
  const user = await requireUser("/dashboard");
  if (user.emailVerifiedAt) return { ok: "auth.verified" };
  if (!rateLimit(`verify:${user.id}`, 3, 15 * 60 * 1000)) return { error: "errors.rateLimited" };
  await sendVerification(user.id, user.email);
  return { ok: "auth.verifySent" };
}

export async function updateProfileAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser("/dashboard");
  const parsed = z.object({ name: nameSchema, phone: phoneSchema }).safeParse({ name: str(fd, "name"), phone: str(fd, "phone") });
  if (!parsed.success) return { error: firstError(parsed.error) };

  let profileImageId = user.profileImageId;
  const file = fd.get("image");
  if (hasFile(file)) {
    const saved = await saveImage(file, 512);
    if ("error" in saved) return saved;
    profileImageId = saved.id;
  }
  await db.update(users).set({ ...parsed.data, profileImageId }).where(eq(users.id, user.id));
  if (profileImageId !== user.profileImageId) await deleteImage(user.profileImageId);
  revalidatePath("/", "layout");
  return { ok: "dashboard.profileSaved" };
}

export async function setLocaleAction(fd: FormData) {
  const locale = fd.get("locale") === "ta" ? "ta" : "en";
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
