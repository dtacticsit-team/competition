import { imageUrl, initials } from "@/lib/format";
import type { Phase } from "@/lib/competitions";

/** Four-petal kolam motif with pulli dots; used as the logo and as an accent. */
export function KolamMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M24 4c6.5 6.5 6.5 13.5 0 20c-6.500-6.500-6.500-13.500 0-20Z" />
      <path d="M24 44c-6.500-6.500-6.500-13.500 0-20c6.500 6.500 6.500 13.500 0 20Z" />
      <path d="M4 24c6.500-6.500 13.500-6.500 20 0c-6.500 6.500-13.500 6.500-20 0Z" />
      <path d="M44 24c-6.500 6.500-13.500 6.500-20 0c6.500-6.500 13.500-6.500 20 0Z" />
      <rect x="12.500" y="12.500" width="23" height="23" rx="6" transform="rotate(45 24 24)" />
      <g fill="currentColor" stroke="none">
        <circle cx="24" cy="13" r="1.5" />
        <circle cx="24" cy="35" r="1.5" />
        <circle cx="13" cy="24" r="1.5" />
        <circle cx="35" cy="24" r="1.5" />
      </g>
    </svg>
  );
}

export function WhatsAppIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.040 2a9.840 9.840 0 0 0-8.430 14.940L2.050 22l5.220-1.530A9.860 9.860 0 1 0 12.040 2Zm0 1.800a8.060 8.060 0 1 1-4.130 14.990l-.300-.180-3.050.890.910-2.950-.200-.310A8.050 8.050 0 0 1 12.040 3.800Zm-3.400 3.900c-.180 0-.470.070-.720.340-.250.270-.950.930-.950 2.260s.970 2.620 1.110 2.800c.140.180 1.900 3.030 4.690 4.130 2.320.910 2.790.730 3.290.680.500-.050 1.620-.660 1.850-1.300.230-.640.230-1.190.160-1.300-.070-.110-.250-.180-.520-.320-.270-.140-1.620-.800-1.870-.890-.250-.090-.430-.140-.610.140-.180.270-.700.890-.860 1.070-.160.180-.320.200-.590.070-.270-.140-1.150-.420-2.190-1.350-.810-.720-1.360-1.610-1.520-1.880-.160-.270-.020-.420.120-.550.120-.120.270-.320.410-.480.140-.160.180-.270.270-.450.090-.180.050-.340-.020-.480-.070-.140-.600-1.480-.840-2.020-.200-.470-.420-.480-.610-.490l-.600-.010Z" />
    </svg>
  );
}

export function FacebookIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M22 12a10 10 0 1 0-11.560 9.880v-6.990H7.900V12h2.540V9.800c0-2.510 1.490-3.890 3.780-3.890 1.090 0 2.240.190 2.240.190v2.460h-1.260c-1.240 0-1.630.770-1.630 1.560V12h2.770l-.440 2.890h-2.330v6.990A10 10 0 0 0 22 12Z" />
    </svg>
  );
}

const AVATAR_SIZES = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-16 w-16 text-xl" } as const;

export function Avatar({ name, imageId, size = "md" }: { name: string; imageId?: string | null; size?: keyof typeof AVATAR_SIZES }) {
  const cls = `${AVATAR_SIZES[size]} shrink-0 rounded-full ring-2 ring-paper`;
  if (imageId) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl(imageId, true)} alt="" className={`${cls} object-cover`} loading="lazy" decoding="async" />;
  }
  return (
    <span aria-hidden="true" className={`${cls} inline-flex items-center justify-center bg-navy/10 font-semibold text-navy`}>
      {initials(name) || "•"}
    </span>
  );
}

const PILL: Record<Phase, string> = {
  open: "bg-leaf-soft text-leaf",
  upcoming: "bg-navy/10 text-navy",
  ended: "bg-sand text-muted",
  results: "bg-gold-soft/35 text-gold",
  draft: "bg-ink/5 text-muted",
  cancelled: "bg-rose/10 text-rose",
};

export function StatusPill({ phase, label }: { phase: Phase; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${PILL[phase]}`}>
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${phase === "open" ? "animate-pulse" : ""}`} />
      {label}
    </span>
  );
}
