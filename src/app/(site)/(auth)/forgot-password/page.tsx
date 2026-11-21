import type { Metadata } from "next";
import Link from "next/link";
import { forgotPasswordAction } from "@/app/actions/auth";
import { Field } from "@/components/blocks";
import { ActionForm } from "@/components/forms";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("auth.forgotTitle") };
}

export default async function ForgotPasswordPage() {
  const { t } = await getT();
  return (
    <>
      <h1 className="mt-4 text-center text-2xl font-semibold text-navy">{t("auth.forgotTitle")}</h1>
      <p className="mt-1.5 text-center text-sm text-muted">{t("auth.forgotText")}</p>
      <div className="mt-6">
        <ActionForm action={forgotPasswordAction} buttons={[{ label: t("auth.sendLink"), className: "btn btn-primary w-full" }]}>
          <Field label={t("auth.email")}>
            <input name="email" type="email" required autoComplete="email" className="input" />
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
