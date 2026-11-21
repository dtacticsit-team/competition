import type { Metadata } from "next";
import Link from "next/link";
import { resetPasswordAction } from "@/app/actions/auth";
import { Field } from "@/components/blocks";
import { ActionForm } from "@/components/forms";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("auth.resetTitle"), robots: { index: false } };
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const { t } = await getT();
  return (
    <>
      <h1 className="mt-4 text-center text-2xl font-semibold text-navy">{t("auth.resetTitle")}</h1>
      <p className="mt-1.5 text-center text-sm text-muted">{t("auth.resetText")}</p>
      <div className="mt-6">
        <ActionForm action={resetPasswordAction} buttons={[{ label: t("auth.resetButton"), className: "btn btn-primary w-full" }]}>
          <input type="hidden" name="token" value={token} />
          <Field label={t("auth.newPassword")} hint={t("auth.passwordHint")}>
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
          </Field>
          <Field label={t("auth.confirmPassword")}>
            <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="input" />
          </Field>
        </ActionForm>
      </div>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-semibold text-navy hover:underline">
          {t("auth.backToLogin")}
        </Link>
      </p>
    </>
  );
}
