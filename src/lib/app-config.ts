import { eq } from "drizzle-orm";
import { db } from "@/db";
import { applications } from "@/db/schema";

export type ApplicationRecord = {
  id: number;
  name: string;
  slug: string;
};

/**
 * Optional cookie domain for cross-subdomain session sharing
 * (e.g. ".dtacticsit.com" for kolamfest.dtacticsit.com & photofest.dtacticsit.com).
 */
export const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN?.trim() || undefined;

let cachedApp: ApplicationRecord | null = null;

/**
 * Reads and validates APP_ID from server-side environment variables.
 * Never trusts client-supplied application IDs.
 */
export function getAppId(): number {
  const raw = process.env.APP_ID;
  if (!raw || !/^\d+$/.test(raw.trim())) {
    throw new Error(
      `Invalid or missing APP_ID environment variable (${raw ?? "undefined"}). Must be a positive integer.`,
    );
  }
  const appId = Number.parseInt(raw.trim(), 10);
  if (!Number.isSafeInteger(appId) || appId <= 0) {
    throw new Error(`Invalid APP_ID (${raw}). Must be a positive integer.`);
  }
  return appId;
}

/**
 * Validates that the configured APP_ID exists in the applications registry
 * and returns the application metadata.
 */
export async function getCurrentApplication(): Promise<ApplicationRecord> {
  const appId = getAppId();
  if (cachedApp && cachedApp.id === appId) {
    return cachedApp;
  }

  const [app] = await db
    .select({
      id: applications.id,
      name: applications.name,
      slug: applications.slug,
    })
    .from(applications)
    .where(eq(applications.id, appId))
    .limit(1);

  if (!app) {
    throw new Error(
      `Configured APP_ID=${appId} does not exist in the applications registry.`,
    );
  }

  cachedApp = app;
  return app;
}

/**
 * Clears the cached application record (useful for tests).
 */
export function clearApplicationCache() {
  cachedApp = null;
}

