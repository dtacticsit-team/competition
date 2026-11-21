import type { Locale } from "./i18n-shared";

/** All user-facing schedules are shown in IST; the database stores UTC. */
const TZ = "Asia/Kolkata";
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const tag = (locale: Locale) => (locale === "ta" ? "ta-IN" : "en-IN");

export const fmtDateTime = (d: Date, locale: Locale) =>
  new Intl.DateTimeFormat(tag(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  }).format(d);

export const fmtDate = (d: Date, locale: Locale) =>
  new Intl.DateTimeFormat(tag(locale), { day: "numeric", month: "short", year: "numeric", timeZone: TZ }).format(d);

export const fmtShort = (d: Date, locale: Locale) =>
  new Intl.DateTimeFormat(tag(locale), { day: "numeric", month: "short", timeZone: TZ }).format(d);

export const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const num = (n: number) => new Intl.NumberFormat("en-IN").format(n);

/** Parse a `datetime-local` value ("2026-01-10T09:00") as IST wall-clock time. */
export function parseIstLocal(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format a Date as an IST `datetime-local` input value. */
export const toIstLocalInput = (d: Date) => new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);

export const imageUrl = (id: string, thumb = false) => `/api/images/${id}${thumb ? "?v=thumb" : ""}`;

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => Array.from(p)[0] ?? "")
    .join("")
    .toUpperCase();

/** Split free-text rules into list items (one per line, bullets stripped). */
export const toLines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
