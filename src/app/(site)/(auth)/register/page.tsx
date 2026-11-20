import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { registerAction } from "@/app/actions/auth";
import { Field } from "@/components/blocks";
import { ActionForm } from "@/components/forms";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("auth.registerTitle") };
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next, "");
  if (await getCurrentUser()) redirect(next || "/dashboard");
  const { t } = await getT();
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <>
      <h1 className="mt-4 text-center text-2xl font-semibold text-navy">{t("auth.registerTitle")}</h1>
      <p className="mt-1.5 text-center text-sm text-muted">{t("auth.registerText")}</p>
      <div className="mt-6">
        <ActionForm action={registerAction} buttons={[{ label: t("auth.registerButton"), className: "btn btn-primary w-full" }]}>
          {next && <input type="hidden" name="next" value={next} />}
          <Field label={t("auth.name")}>
            <input name="name" required minLength={2} maxLength={80} autoComplete="name" className="input" />
          </Field>
          <Field label={t("auth.email")}>
            <input name="email" type="email" required autoComplete="email" className="input" />
          </Field>
          <Field label={t("auth.phone")} hint={t("auth.phoneHint")}>
            <input name="phone" type="tel" required autoComplete="tel" inputMode="tel" className="input" />
          </Field>
          <Field label={t("auth.password")} hint={t("auth.passwordHint")}>
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
          </Field>
          <Field label={t("auth.confirmPassword")}>
            <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="input" />
          </Field>
        </ActionForm>
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        {t("auth.haveAccount")}{" "}
        <Link href={loginHref} className="font-semibold text-saffron hover:underline">
          {t("nav.login")}
        </Link>
      </p>
    </>
  );
}
