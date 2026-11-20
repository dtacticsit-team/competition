"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Heart, Link2, LoaderCircle, Share2 } from "lucide-react";
import { imageUrl, num } from "@/lib/format";
import type { MsgKey } from "@/lib/i18n-shared";
import type { FeedItem } from "@/lib/queries";
import { Avatar, FacebookIcon, WhatsAppIcon } from "./brand";
import { useT } from "./i18n-provider";

const VOTE_ERRORS: Record<string, MsgKey> = { rate: "like.errorRate", limit: "like.errorRate", closed: "like.closed" };

/** Like / unlike with optimistic UI; the server response is authoritative. */
export function LikeButton({ id, likes, liked, open, large = false }: { id: string; likes: number; liked: boolean; open: boolean; large?: boolean }) {
  const t = useT();
  const [state, setState] = useState({ likes, liked });
  const [busy, setBusy] = useState(false);
  const [pop, setPop] = useState(false);
  const [error, setError] = useState<MsgKey | null>(null);
  const size = large ? "min-h-12 px-5 text-base" : "min-h-10 px-3.5 text-sm";

  if (!open) {
    return (
      <span className={`inline-flex items-center gap-2 rounded-full bg-sand font-semibold text-ink/80 ${size}`} title={t("like.closed")}>
        <Heart className="h-[1.1em] w-[1.1em] fill-rose text-rose" aria-hidden="true" />
        <span>{num(state.likes)}</span>
        <span className="sr-only">{t("like.closed")}</span>
      </span>
    );
  }

  async function toggle() {
    if (busy) return;
    const previous = state;
    const next = !state.liked;
    setState({ liked: next, likes: Math.max(0, state.likes + (next ? 1 : -1)) });
    setPop(next);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: id, like: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setState({ likes: data.likes, liked: data.liked });
    } catch (err) {
      setState(previous);
      setError(VOTE_ERRORS[err instanceof Error ? err.message : ""] ?? "like.errorGeneric");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={state.liked}
        aria-label={`${state.liked ? t("like.unlike") : t("like.like")} · ${num(state.likes)}`}
        className={`inline-flex cursor-pointer items-center gap-2 rounded-full border font-semibold transition duration-200 active:scale-95 ${size} ${
          state.liked ? "border-rose bg-rose text-white" : "border-rose/30 bg-rose/5 text-rose hover:bg-rose/10"
        }`}
      >
        <Heart
          className={`h-[1.1em] w-[1.1em] ${state.liked ? "fill-current" : ""} ${pop ? "heart-pop" : ""}`}
          onAnimationEnd={() => setPop(false)}
          aria-hidden="true"
        />
        <span aria-live="polite">{num(state.likes)}</span>
        {large && <span>{state.liked ? t("like.liked") : t("like.like")}</span>}
      </button>
      {error && (
        <span role="alert" className="text-xs font-medium text-rose">
          {t(error)}
        </span>
      )}
    </span>
  );
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      window.prompt("", text); // clipboard blocked: let the user copy manually
    }
  };
  return { copied, copy };
}

/** Compact share: native share sheet on phones, copy-link elsewhere. */
export function ShareButton({ path, title }: { path: string; title: string }) {
  const t = useT();
  const { copied, copy } = useCopy();
  async function share() {
    const url = new URL(path, window.location.origin).toString();
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // user dismissed the share sheet
      }
      return;
    }
    await copy(url);
  }
  return (
    <button type="button" onClick={share} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-3.5 text-sm font-semibold text-ink/80 transition hover:border-navy/40 hover:text-ink active:scale-95">
      {copied ? <Check className="h-4 w-4 text-leaf" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
      <span aria-live="polite">{copied ? t("share.copied") : t("share.share")}</span>
    </button>
  );
}

/** Full share row for the post page: WhatsApp, Facebook, copy link. */
export function SharePanel({ url, text }: { url: string; text: string }) {
  const t = useT();
  const { copied, copy } = useCopy();
  const round = "inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white transition hover:scale-105 active:scale-95";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <a href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer" className={`${round} bg-[#128c4a]`} aria-label={t("share.whatsapp")} title={t("share.whatsapp")}>
          <WhatsAppIcon />
        </a>
        <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" className={`${round} bg-[#1663d6]`} aria-label={t("share.facebook")} title={t("share.facebook")}>
          <FacebookIcon />
        </a>
        <button type="button" onClick={() => copy(url)} className="btn btn-outline">
          {copied ? <Check className="h-4 w-4 text-leaf" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
          <span aria-live="polite">{copied ? t("share.copied") : t("share.copyLink")}</span>
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-white py-1 pr-1 pl-3.5">
        <span className="min-w-0 flex-1 truncate text-sm text-muted" dir="ltr">
          {url}
        </span>
        <button type="button" onClick={() => copy(url)} className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-navy hover:bg-navy/5" aria-label={t("share.copyLink")}>
          <Copy className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function KolamCard({ item, eager = false }: { item: FeedItem; eager?: boolean }) {
  const t = useT();
  const alt = item.title ? `${item.title} — ${item.userName}` : t("feed.imageAlt", { name: item.userName });
  return (
    <article className="card group flex flex-col overflow-hidden">
      <header className="flex items-center gap-3 px-4 py-3">
        <Avatar name={item.userName} imageId={item.userImageId} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{item.userName}</p>
          <p className="truncate text-xs text-muted">
            <Link href={`/competitions/${item.competitionId}`} className="hover:text-navy hover:underline">
              {item.competitionTitle}
            </Link>
            <span aria-hidden="true"> · </span>
            {item.dateLabel}
          </p>
        </div>
      </header>
      <Link href={`/p/${item.id}`} className="block aspect-square overflow-hidden bg-sand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl(item.imageId, true)}
          srcSet={`${imageUrl(item.imageId, true)} 720w, ${imageUrl(item.imageId)} 1600w`}
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.03]"
        />
      </Link>
      <div className="flex flex-1 flex-col gap-3 px-4 py-3.5">
        {item.title && (
          <h3 className="line-clamp-1 font-sans text-[15px] font-semibold tracking-normal text-ink">
            <Link href={`/p/${item.id}`} className="hover:text-navy">
              {item.title}
            </Link>
          </h3>
        )}
        <div className="mt-auto flex items-start justify-between gap-2">
          <LikeButton id={item.id} likes={item.likes} liked={item.liked} open={item.votingOpen} />
          <ShareButton path={`/p/${item.id}`} title={alt} />
        </div>
      </div>
    </article>
  );
}

/** Paginated grid of entries: one column on phones, up to three on desktop. */
export function Feed({ initialItems, initialHasMore, competitionId, narrow = false }: { initialItems: FeedItem[]; initialHasMore: boolean; competitionId?: string; narrow?: boolean }) {
  const t = useT();
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function loadMore() {
    setLoading(true);
    setFailed(false);
    try {
      const params = new URLSearchParams({ offset: String(items.length) });
      if (competitionId) params.set("competitionId", competitionId);
      const res = await fetch(`/api/feed?${params}`);
      if (!res.ok) throw new Error();
      const data: { items: FeedItem[]; hasMore: boolean } = await res.json();
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...data.items.filter((i) => !seen.has(i.id))];
      });
      setHasMore(data.hasMore);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className={`grid gap-5 sm:grid-cols-2 ${narrow ? "" : "lg:grid-cols-3"}`}>
        {items.map((item, i) => (
          <KolamCard key={item.id} item={item} eager={i < 2} />
        ))}
      </div>
      {failed && (
        <p role="alert" className="mt-6 text-center text-sm font-medium text-rose">
          {t("errors.generic")}
        </p>
      )}
      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button type="button" onClick={loadMore} disabled={loading} className="btn btn-outline">
            {loading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("common.loadMore")}
          </button>
        </div>
      )}
    </div>
  );
}

/** Live countdown driven by the server clock (the browser clock only ticks it). */
export function Countdown({ targetIso, nowIso, label }: { targetIso: string; nowIso: string; label: string }) {
  const t = useT();
  const router = useRouter();
  const target = new Date(targetIso).getTime();
  const [remaining, setRemaining] = useState(() => Math.max(0, target - new Date(nowIso).getTime()));

  useEffect(() => {
    const skew = new Date(nowIso).getTime() - Date.now();
    const timer = setInterval(() => {
      const left = Math.max(0, target - (Date.now() + skew));
      setRemaining(left);
      if (left === 0) {
        clearInterval(timer);
        router.refresh(); // let the server confirm the new state
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [target, nowIso, router]);

  const s = Math.floor(remaining / 1000);
  const parts: [number, MsgKey][] = [
    [Math.floor(s / 86400), "countdown.days"],
    [Math.floor((s % 86400) / 3600), "countdown.hours"],
    [Math.floor((s % 3600) / 60), "countdown.minutes"],
    [s % 60, "countdown.seconds"],
  ];
  return (
    <div role="timer" aria-label={label}>
      <p className="mb-2 text-xs font-semibold tracking-wide opacity-80">{label}</p>
      <div className="flex gap-2">
        {parts.map(([value, key]) => (
          <div key={key} className="min-w-14 rounded-xl bg-current/10 px-2 py-2 text-center">
            <div className="text-xl leading-none font-semibold tabular-nums">{String(value).padStart(2, "0")}</div>
            <div className="mt-1 text-[10px] font-medium opacity-80">{t(key)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
