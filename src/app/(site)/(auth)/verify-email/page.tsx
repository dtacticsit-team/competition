import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { authTokens, users } from "@/db/schema";
import { sha256 } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

async function consume(token: string) {
  if (!token) return false;
  const [row] = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, sha256(token)), eq(authTokens.type, "verify"), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())));
  if (!row) return false;
  await db.transaction(async (tx) => {
    await tx.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, row.userId));
    await tx.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, row.id));
  });
  return true;
}

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const ok = await consume((await searchParams).token ?? "");
  const { t } = await getT();
  return (
    <div className="text-center">
      <h1 className="mt-4 text-2xl font-semibold text-navy">{ok ? t("auth.verifyOkTitle") : t("auth.verifyFailTitle")}</h1>
      <p className="mt-2 text-[15px] text-muted">{ok ? t("auth.verifyOkText") : t("auth.verifyFailText")}</p>
      <Link href="/dashboard" className="btn btn-primary mt-6">
        {t("nav.dashboard")}
      </Link>
    </div>
  );
}
