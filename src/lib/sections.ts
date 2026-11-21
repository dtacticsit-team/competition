/** Application sections a design reference image can be attached to. */
export const REFERENCE_SECTIONS = [
  "homepage",
  "feed",
  "post",
  "auth",
  "participant",
  "admin",
  "sponsors",
  "competition",
  "mobile",
] as const;

export type ReferenceSection = (typeof REFERENCE_SECTIONS)[number];

export const isReferenceSection = (v: unknown): v is ReferenceSection =>
  typeof v === "string" && (REFERENCE_SECTIONS as readonly string[]).includes(v);
