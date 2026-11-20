/**
 * Transactional mail. Sends through Resend's HTTP API when RESEND_API_KEY and
 * MAIL_FROM are configured; otherwise the message is written to the server
 * log so links can still be retrieved during setup.
 */
export async function sendMail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) {
    console.log(`[mail:not-configured] to=${to} subject="${subject}"\n${text}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) console.error(`[mail] send failed: ${res.status} ${await res.text()}`);
    return res.ok;
  } catch (err) {
    console.error("[mail] send failed", err);
    return false;
  }
}
