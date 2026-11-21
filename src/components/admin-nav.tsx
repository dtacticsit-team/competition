"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, HeartHandshake, Images, LayoutDashboard, LogOut, Trophy } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { KolamMark } from "./brand";
import { useT } from "./i18n-provider";
import { LanguageSwitcher } from "./site-nav";

export function AdminNav() {
  const t = useT();
  const pathname = usePathname();
  // Exactly three primary sections; the reference library is a secondary tool.
  const primary = [
    { href: "/admin", label: t("admin.dashboard"), icon: LayoutDashboard },
    { href: "/admin/sponsors", label: t("admin.sponsors"), icon: HeartHandshake },
    { href: "/admin/prizes", label: t("admin.prizes"), icon: Trophy },
  ];
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" || pathname.startsWith("/admin/competitions") : pathname.startsWith(href));
  const item = (href: string) =>
    `flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium whitespace-nowrap transition ${
      active(href) ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
    }`;

  return (
    <aside className="kolam-dots-light bg-navy-deep text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-5 lg:pt-6 lg:pb-5">
        <Link href="/admin" className="flex items-center gap-2.5">
          <KolamMark className="h-8 w-8 text-marigold" />
          <span className="font-display text-xl font-semibold">{t("site.name")}</span>
          <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide">{t("nav.admin")}</span>
        </Link>
        <div className="lg:hidden">
          <LanguageSwitcher dark />
        </div>
      </div>

      <nav aria-label={t("nav.admin")} className="flex items-center gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:items-stretch lg:overflow-visible lg:pb-0">
        {primary.map((l) => (
          <Link key={l.href} href={l.href} aria-current={active(l.href) ? "page" : undefined} className={item(l.href)}>
            <l.icon className="h-[18px] w-[18px]" aria-hidden="true" />
            {l.label}
          </Link>
        ))}
        <span className="mx-1 h-5 w-px shrink-0 bg-white/20 lg:mx-3 lg:mt-5 lg:mb-1 lg:h-auto lg:w-auto lg:bg-transparent lg:text-[11px] lg:font-semibold lg:tracking-wide lg:text-white/50">
          <span className="hidden lg:inline">{t("admin.tools")}</span>
        </span>
        <Link href="/admin/references" aria-current={active("/admin/references") ? "page" : undefined} className={item("/admin/references")}>
          <Images className="h-[18px] w-[18px]" aria-hidden="true" />
          {t("admin.references")}
        </Link>
        <Link href="/" className={`${item("/__site")} lg:hidden`}>
          <ExternalLink className="h-[18px] w-[18px]" aria-hidden="true" />
          {t("admin.viewSite")}
        </Link>
      </nav>

      <div className="mt-auto hidden space-y-3 border-t border-white/10 p-4 lg:block">
        <LanguageSwitcher dark />
        <Link href="/" className={item("/__site")}>
          <ExternalLink className="h-[18px] w-[18px]" aria-hidden="true" />
          {t("admin.viewSite")}
        </Link>
        <form action={logoutAction}>
          <button className={`${item("/__logout")} w-full cursor-pointer`}>
            <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
            {t("nav.logout")}
          </button>
        </form>
      </div>
    </aside>
  );
}
