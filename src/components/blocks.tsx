import type { ReactNode } from "react";
import { imageUrl, inr } from "@/lib/format";
import { KolamMark } from "./brand";

export function EmptyState({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="kolam-dots rounded-3xl border border-dashed border-line bg-paper/70 px-6 py-14 text-center">
      <KolamMark className="mx-auto h-12 w-12 text-marigold" />
      <h3 className="mt-4 text-xl font-semibold text-navy">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-[15px] text-muted">{text}</p>
      {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}

const RANK = ["bg-[#f6d77a] text-[#5c4300]", "bg-[#dfe3ea] text-[#3b4252]", "bg-[#eec3a0] text-[#6b3410]"];

export function RankBadge({ rank, large = false }: { rank: number; large?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold tabular-nums ${large ? "h-10 w-10 text-base" : "h-7 w-7 text-xs"} ${RANK[rank - 1] ?? "bg-sand text-muted"}`}
    >
      {rank}
    </span>
  );
}

/** The three fixed platform prizes, e.g. ₹5,000 | ₹3,000 | ₹1,000. */
export function PrizeRow({ prizes, labels }: { prizes: { first: number; second: number; third: number }; labels: [string, string, string] }) {
  const amounts = [prizes.first, prizes.second, prizes.third];
  return (
    <dl className="grid grid-cols-3 divide-x divide-line text-center">
      {amounts.map((amount, i) => (
        <div key={i} className="px-1.5">
          <dt className="flex flex-col items-center gap-1.5 text-xs leading-snug font-medium text-muted">
            <RankBadge rank={i + 1} />
            <span>{labels[i]}</span>
          </dt>
          <dd className="mt-1 text-lg font-semibold text-navy tabular-nums">{inr(amount)}</dd>
        </div>
      ))}
    </dl>
  );
}

type Sponsor = { id: string; name: string; description: string | null; imageId: string };

export function SponsorStrip({ sponsors, title }: { sponsors: Sponsor[]; title: string }) {
  if (!sponsors.length) return null;
  return (
    <section aria-labelledby="sponsors-title" className="page mt-14">
      <div className="card px-5 py-7 sm:px-8">
        <h2 id="sponsors-title" className="eyebrow text-center">
          {title}
        </h2>
        <ul className="mt-5 flex flex-wrap items-start justify-center gap-x-10 gap-y-6">
          {sponsors.map((s) => (
            <li key={s.id} className="flex w-36 flex-col items-center text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl(s.imageId, true)} alt={s.name} loading="lazy" decoding="async" className="h-14 w-full object-contain" />
              <p className="mt-2 text-sm font-semibold text-ink">{s.name}</p>
              {s.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{s.description}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}
