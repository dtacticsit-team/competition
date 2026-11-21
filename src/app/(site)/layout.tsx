import type { ReactNode } from "react";
import Link from "next/link";
import { KolamMark } from "@/components/brand";
import { SiteNav } from "@/components/site-nav";
import { getCurrentUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const [user, { t }] = await Promise.all([getCurrentUser(), getT()]);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-navy focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">
        {t("nav.skip")}
      </a>
      <SiteNav user={user ? { name: user.name, username: user.username, role: user.role, profileImageId: user.profileImageId } : null} />
      <main id="main" className="pb-10">
        {children}
      </main>
      <footer className="mt-10 border-t border-line pb-24 md:pb-0">
        <div className="page flex flex-col items-center justify-between gap-4 py-8 text-sm text-muted sm:flex-row">
          <div className="flex items-center gap-2.5">
            <KolamMark className="h-6 w-6 text-marigold" />
            <span>{t("site.tagline")}</span>
          </div>
          <nav aria-label={t("nav.footer")} className="flex flex-wrap justify-center gap-x-5 gap-y-1">
            <Link href="/competitions" className="hover:text-navy">
              {t("nav.competitions")}
            </Link>
            <Link href="/winners" className="hover:text-navy">
              {t("nav.winners")}
            </Link>
            <Link href="/dashboard" className="hover:text-navy">
              {t("nav.dashboard")}
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
