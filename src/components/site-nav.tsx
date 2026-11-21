"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, Home, LogIn, LogOut, ShieldCheck, Trophy, User } from "lucide-react";
import { logoutAction, setLocaleAction } from "@/app/actions/auth";
import { Avatar, KolamMark } from "./brand";
import { useLocale, useT } from "./i18n-provider";

type NavUser = { name: string; username?: string | null; role: string; profileImageId: string | null } | null;

export function LanguageSwitcher({ dark = false }: { dark?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const base = "min-h-8 cursor-pointer rounded-full px-2.5 text-xs font-semibold transition";
  const on = dark ? "bg-white text-navy-deep" : "bg-navy text-white";
  const off = dark ? "text-white/80 hover:text-white" : "text-muted hover:text-ink";
  return (
    <form action={setLocaleAction} aria-label={t("nav.language")} className={`inline-flex items-center rounded-full border p-0.5 ${dark ? "border-white/25" : "border-line bg-white"}`}>
      <button name="locale" value="en" lang="en" aria-pressed={locale === "en"} className={`${base} ${locale === "en" ? on : off}`}>
        EN
      </button>
      <button name="locale" value="ta" lang="ta" aria-pressed={locale === "ta"} className={`${base} ${locale === "ta" ? on : off}`}>
        தமிழ்
      </button>
    </form>
  );
}

export function SiteNav({ user }: { user: NavUser }) {
  const t = useT();
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const account = user
    ? { href: "/dashboard", label: t("nav.dashboard"), icon: User }
    : { href: "/login", label: t("nav.login"), icon: LogIn };
  const links = [
    { href: "/", label: t("nav.home"), icon: Home },
    { href: "/competitions", label: t("nav.competitions"), icon: Trophy },
    { href: "/winners", label: t("nav.winners"), icon: Award },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line/80 bg-cream/90 backdrop-blur-md">
        <div className="page flex h-16 items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-navy" aria-label={t("site.name")}>
            <KolamMark className="h-8 w-8 text-saffron" />
            <span className="font-display text-xl font-semibold tracking-tight">{t("site.name")}</span>
          </Link>

          <nav aria-label={t("nav.main")} className="ml-6 hidden items-center gap-1 md:flex">
            {[...links, ...(user ? [account] : [])].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(l.href) ? "page" : undefined}
                className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${
                  isActive(l.href) ? "bg-navy/10 text-navy" : "text-ink/75 hover:bg-navy/5 hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher />
            {user?.role === "admin" && (
              <Link href="/admin" className="btn btn-outline btn-sm" title={t("nav.admin")}>
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t("nav.admin")}</span>
              </Link>
            )}
            {user ? (
              <>
                <Link href="/dashboard" className="hidden md:block" aria-label={user.name} title={user.name}>
                  <Avatar name={user.name} imageId={user.profileImageId} size="sm" />
                </Link>
                <form action={logoutAction}>
                  <button className="btn btn-outline btn-sm" title={t("nav.logout")}>
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">{t("nav.logout")}</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="hidden items-center gap-2 md:flex">
                <Link href="/login" className="btn btn-outline btn-sm">
                  {t("nav.login")}
                </Link>
                <Link href="/register" className="btn btn-primary btn-sm">
                  {t("nav.register")}
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile tab bar, as in the reference phone layouts */}
      <nav
        aria-label={t("nav.main")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {[...links, account].map((l) => {
            const active = isActive(l.href);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] leading-tight font-medium transition ${
                    active ? "text-saffron" : "text-muted"
                  }`}
                >
                  <l.icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.9} aria-hidden="true" />
                  <span className="max-w-full truncate">{l.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
