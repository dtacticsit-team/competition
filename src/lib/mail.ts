import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

const g = globalThis as typeof globalThis & {
  __kolamTransporter?: Transporter | null;
};

/**
 * Lazily initializes and caches a reusable Nodemailer SMTP transporter singleton.
 * Uses connection pooling for high performance and low latency under PM2.
 */
function getTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    return null;
  }

  if (!g.__kolamTransporter) {
    const port = Number(process.env.SMTP_PORT) || 587;
    // Support port 465 with SMTP_SECURE=true and port 587 with SMTP_SECURE=false
    const secure = process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === "true"
      : port === 465;

    const user = process.env.SMTP_USER?.trim();
    const pass = (process.env.SMTP_PASSWORD ?? process.env.SMTP_PASS)?.trim();

    g.__kolamTransporter = nodemailer.createTransport({
      pool: true,
      host,
      port,
      secure,
      requireTLS: !secure,
      auth: user || pass ? { user: user ?? "", pass: pass ?? "" } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }

  return g.__kolamTransporter;
}

/**
 * Transactional email delivery via Nodemailer SMTP.
 * Safe against missing configuration and provider delivery failures so
 * user authentication flows (registration, login, reset) are never interrupted.
 */
export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  const from = process.env.MAIL_FROM?.trim();
  const transporter = getTransporter();

  if (!transporter || !from) {
    console.warn(`[mail:not-configured] delivery skipped to=${to} subject="${subject}" (SMTP_HOST or MAIL_FROM unset)`);
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
    });
    console.log(`[mail] sent to=${to} subject="${subject}" messageId=${info.messageId}`);
    return true;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[mail] delivery failed to=${to} subject="${subject}": ${errorMsg}`);
    return false;
  }
}

