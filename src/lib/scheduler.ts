import { processLifecycle } from "./competitions";

const INTERVAL_MS = 30_000;
const g = globalThis as typeof globalThis & { __kolamScheduler?: NodeJS.Timeout };

/**
 * In-process worker for a single Next.js server process. Each tick is
 * idempotent, so restarts or overlapping runs cannot double-process results.
 */
export function startScheduler() {
  if (g.__kolamScheduler) return;
  const tick = async () => {
    try {
      const closed = await processLifecycle();
      if (closed) console.log(`[scheduler] finalized ${closed} competition(s)`);
    } catch (err) {
      console.error("[scheduler] lifecycle tick failed", err);
    }
  };
  g.__kolamScheduler = setInterval(tick, INTERVAL_MS);
  g.__kolamScheduler.unref();
  void tick();
}
