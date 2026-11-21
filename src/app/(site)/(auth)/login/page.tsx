import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { Field } from "@/components/blocks";
import { ActionForm } from "@/components/forms";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("auth.loginTitle") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "");
  if (await getCurrentUser()) redirect(next || "/dashboard");
  const { t } = await getT();
  const registerHref = next ? `/register?next=${encodeURIComponent(next)}` : "/register";

  return (
    <>
      <h1 className="mt-4 text-center text-2xl font-semibold text-navy">{t("auth.loginTitle")}</h1>
      <p className="mt-1.5 text-center text-sm text-muted">{t("auth.loginText")}</p>
      {sp.reset && (
        <p role="status" className="mt-4 rounded-xl border border-leaf/20 bg-leaf-soft px-3.5 py-2.5 text-sm font-medium text-leaf">
          {t("auth.resetDone")}
        </p>
      )}
      <div className="mt-6">
        <ActionForm action={loginAction} buttons={[{ label: t("auth.loginButton"), className: "btn btn-primary w-full" }]}>
          {next && <input type="hidden" name="next" value={next} />}
          <Field label={t("auth.email")}>
            <input name="email" type="email" required autoComplete="email" className="input" />
          </Field>
          <Field label={t("auth.password")}>
            <input name="password" type="password" required autoComplete="current-password" className="input" />
          </Field>
          <p className="text-right text-sm">
            <Link href="/forgot-password" className="font-semibold text-navy hover:underline">
              {t("auth.forgot")}
            </Link>
          </p>
        </ActionForm>
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        {t("auth.noAccount")}{" "}
        <Link href={registerHref} className="font-semibold text-saffron hover:underline">
          {t("nav.register")}
        </Link>
      </p>
    </>
  );
}
