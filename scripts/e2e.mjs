// End-to-end smoke test against a running server (default http://localhost:3000).
// Drives the real forms the way a browser without JavaScript would, plus the JSON APIs.
// WARNING: creates test data. Run only against a disposable database.
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const DB = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/app_db";
const sql = (q) => execSync(`psql "${DB}" -At -c "${q.replace(/"/g, '\\"')}"`).toString().trim();
let failed = 0;
const ok = (cond, label, extra = "") => {
  if (!cond) failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond ? "" : `  ${extra}`}`);
};
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

class Client {
  jar = {};
  headers(extra = {}) {
    const cookie = Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join("; ");
    return { ...(cookie ? { cookie } : {}), origin: BASE, ...extra };
  }
  store(res) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const [k, v] = [pair.slice(0, i), pair.slice(i + 1)];
      if (v === "" || /max-age=0|expires=thu, 01 jan 1970/i.test(c)) delete this.jar[k];
      else this.jar[k] = v;
    }
    return res;
  }
  async get(path) {
    const res = this.store(await fetch(BASE + path, { headers: this.headers(), redirect: "manual" }));
    return { status: res.status, location: res.headers.get("location"), html: await res.text() };
  }
  /** Submit the first <form> on `path` whose HTML contains `marker`. */
  async form(path, marker, fields = {}, files = {}) {
    const page = await this.get(path);
    const chunk = page.html.split("<form").slice(1).map((c) => c.split("</form>")[0]).find((c) => c.includes(marker));
    if (!chunk) return { status: 0, html: page.html, location: null, missing: true };
    const fd = new FormData();
    for (const tag of chunk.match(/<input[^>]*type="hidden"[^>]*>/g) ?? []) {
      const name = tag.match(/name="([^"]*)"/)?.[1];
      if (name) fd.set(decode(name), decode(tag.match(/value="([^"]*)"/)?.[1] ?? ""));
    }
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    for (const [k, f] of Object.entries(files)) fd.set(k, new File([f.data], f.name, { type: f.type }));
    const res = this.store(await fetch(BASE + path, { method: "POST", body: fd, headers: this.headers(), redirect: "manual" }));
    return { status: res.status, location: res.headers.get("location"), html: await res.text() };
  }
  async vote(submissionId, like) {
    const res = this.store(
      await fetch(`${BASE}/api/vote`, { method: "POST", headers: this.headers({ "content-type": "application/json" }), body: JSON.stringify({ submissionId, like }) }),
    );
    return { status: res.status, ...(await res.json()) };
  }
}

const ist = (d) => new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 16);
const photo = { data: readFileSync("public/images/kolam-hero.jpg"), name: "kolam.jpg", type: "image/jpeg" };
const png = async (color) => sharp({ create: { width: 900, height: 900, channels: 3, background: color } }).png().toBuffer();
const stamp = Date.now();
const account = (n) => ({ name: `Test User ${n}`, email: `e2e-${n}-${stamp}@example.com`, phone: "9876543210", password: "kolam-pass-1", confirm: "kolam-pass-1" });

// ---- Accounts -------------------------------------------------------------
const admin = new Client();
const firstUser = Number(sql("select count(*) from users")) === 0;
let r = await admin.form("/register", 'name="email"', { ...account("admin"), confirm: "different" });
ok(r.status === 200 && r.html.includes("passwords don"), "register: mismatched passwords rejected");
r = await admin.form("/register", 'name="email"', account("admin"));
ok(r.status === 303, "register: account created", `${r.status}`);
if (!firstUser) sql(`update users set role='admin' where email='${account("admin").email}'`);
ok((await admin.get("/admin")).status === 200, "admin: first account can open /admin");
r = await new Client().form("/register", 'name="email"', account("admin"));
ok(r.html.includes("already exists"), "register: duplicate email rejected");

const u1 = new Client(), u2 = new Client();
ok((await u1.form("/register", 'name="email"', account(1))).status === 303, "register: participant 1");
ok((await u2.form("/register", 'name="email"', account(2))).status === 303, "register: participant 2");
ok((await u1.get("/admin")).status === 404, "authz: participant gets 404 on /admin");
ok((await new Client().get("/admin")).status === 307, "authz: anonymous redirected from /admin");

const relog = new Client();
r = await relog.form("/login", 'name="email"', { email: account(1).email, password: "wrong-password" });
ok(r.html.includes("incorrect"), "login: wrong password rejected");
r = await relog.form("/login", 'name="email"', { email: account(1).email, password: account(1).password });
ok(r.status === 303 && r.location?.includes("/dashboard"), "login: correct password accepted");
r = await relog.form("/dashboard", "lucide-log-out", {});
ok(r.status === 303 && (await relog.get("/dashboard")).status === 307, "logout: session ended");

// Password reset (token inserted directly because no mail transport is configured here)
const token = `e2e-token-${stamp}`;
sql(`insert into auth_tokens (user_id, type, token_hash, expires_at) select id, 'reset', '${createHash("sha256").update(token).digest("hex")}', now() + interval '1 hour' from users where email='${account(2).email}'`);
r = await new Client().form(`/reset-password?token=${token}`, 'name="password"', { password: "new-kolam-pass-2", confirm: "new-kolam-pass-2" });
ok(r.status === 303 && r.location?.includes("reset=1"), "reset: password changed with valid token");
ok((await u2.get("/dashboard")).status === 307, "reset: old sessions signed out");
ok((await u2.form("/login", 'name="email"', { email: account(2).email, password: "new-kolam-pass-2" })).status === 303, "reset: new password works");
r = await new Client().form(`/reset-password?token=${token}`, 'name="password"', { password: "another-pass-3", confirm: "another-pass-3" });
ok(r.html.includes("expired or was already used"), "reset: token cannot be reused");

// ---- Competition setup ----------------------------------------------------
const now = new Date();
const base = { title: `E2E Pongal Kolam ${stamp}`, description: "Test competition", rules: "Traditional Kolam only\nOne entry per participant", prizeInfo: "" };
r = await admin.form("/admin/competitions/new", 'name="title"', { ...base, startAt: ist(now), endAt: ist(new Date(now - 3600e3)), intent: "publish" });
ok(r.html.includes("end must be after the start"), "competition: end-before-start rejected");
r = await admin.form("/admin/competitions/new", 'name="title"', { ...base, startAt: ist(new Date(now - 3600e3)), endAt: ist(new Date(+now + 3600e3)), intent: "publish" }, { banner: { data: await png("#7a4a2b"), name: "banner.png", type: "image/png" } });
ok(r.status === 303, "competition: created and published", `${r.status}`);
const cid = sql(`select id from competitions where title='${base.title}'`);
r = await new Client().get(`/competitions/${cid}`);
ok(r.status === 200 && r.html.includes("Registration, submission and voting are open"), "competition: public page shows all three activities open");

// ---- Registration + submission --------------------------------------------
r = await u1.form(`/competitions/${cid}/submit`, 'name="title"', {});
ok(r.missing || r.status !== 303, "submit: blocked before registering for the competition");
r = await u1.form(`/competitions/${cid}`, 'name="competitionId"', {});
ok(r.status === 303 && r.location?.endsWith("/submit"), "competition: participant 1 registered");
await u1.form(`/competitions/${cid}`, 'name="competitionId"', {});
ok(sql(`select count(*) from registrations where competition_id='${cid}'`) === "1", "competition: duplicate registration prevented");

r = await u1.form(`/competitions/${cid}/submit`, 'name="title"', { title: "Not an image" }, { image: { data: Buffer.from("this is not an image"), name: "fake.png", type: "image/png" } });
ok(r.html.includes("Only JPG, PNG or WebP"), "submit: non-image file rejected by server-side sniffing");
r = await u1.form(`/competitions/${cid}/submit`, 'name="title"', { title: "Lotus Kolam", description: "First entry" }, { image: { data: await png("#b5651d"), name: "one.png", type: "image/png" } });
ok(r.status === 303 && r.location?.includes("/p/"), "submit: participant 1 entry published", `${r.status}`);
const s1 = r.location.split("/p/")[1];
r = await u1.form(`/competitions/${cid}/submit`, 'name="title"', { title: "Lotus Kolam (edited)", description: "Replaced" }, { image: photo });
ok(r.status === 303 && r.location?.endsWith(`/p/${s1}`), "submit: entry edited and image replaced, same permanent URL");
ok(sql(`select count(*) from submissions where competition_id='${cid}'`) === "1", "submit: still exactly one entry for participant 1");

await u2.form(`/competitions/${cid}`, 'name="competitionId"', {});
r = await u2.form(`/competitions/${cid}/submit`, 'name="title"', { title: "" }, { image: photo });
ok(r.status === 303, "submit: participant 2 entry published (no title)");
const s2 = r.location.split("/p/")[1];

r = await new Client().get(`/p/${s1}`);
ok(r.html.includes('property="og:image"') && r.html.includes("Lotus Kolam (edited)"), "post: public page has Open Graph tags");
const imageId = sql(`select image_id from submissions where id='${s1}'`);
for (const [variant, type] of [["", "image/webp"], ["?v=thumb", "image/webp"], ["?v=og", "image/jpeg"]]) {
  const img = await fetch(`${BASE}/api/images/${imageId}${variant}`);
  ok(img.status === 200 && img.headers.get("content-type") === type, `image: ${variant || "full"} served as ${type}`);
}

// ---- Voting ---------------------------------------------------------------
const [a, b, c, d] = [new Client(), new Client(), new Client(), new Client()];
let v = await a.vote(s1, true);
ok(v.status === 200 && v.likes === 1 && a.jar.kolam_vid, "vote: anonymous like counted, visitor cookie issued");
v = await a.vote(s1, true);
ok(v.likes === 1, "vote: duplicate like from same visitor ignored");
v = await b.vote(s1, true);
ok(v.likes === 2, "vote: second visitor counted");
v = await a.vote(s1, false);
ok(v.likes === 1 && v.liked === false, "vote: unlike works");
v = await a.vote(s1, true);
await c.vote(s2, true);
v = await d.vote(s2, true);
ok(v.likes === 2, "vote: entry 2 has two likes (tie with entry 1)");
r = await new Client().get(`/competitions/${cid}`);
ok(r.html.indexOf(`/p/${s1}`) < r.html.indexOf(`/p/${s2}`) && r.html.indexOf(`/p/${s1}`) > 0, "leaderboard: tie broken by earlier submission");
v = await fetch(`${BASE}/api/vote`, { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body: JSON.stringify({ submissionId: s1, like: true }) });
ok(v.status === 403, "vote: cross-origin request rejected");
for (let i = 0; i < 9; i++) await new Client().vote(s1, true);
ok(sql(`select count(*) from votes where submission_id='${s1}'`) === "11", "vote: 11 likes recorded on entry 1");
ok(sql(`select count(*) from votes where submission_id='${s1}' and suspicious`) === "1", "vote: burst from one network flagged for review");
ok(Number(sql(`select count(*) from vote_events where submission_id='${s1}'`)) >= 13, "vote: audit trail written");
r = await admin.form("/admin", 'name="submissionId"', {});
ok(r.status === 303 || r.status === 200, "moderation: admin excluded flagged likes");
ok(sql(`select count(*) from votes where submission_id='${s1}' and eligible`) === "10", "moderation: eligible count drops to 10");

// ---- Deadline -------------------------------------------------------------
sql(`update competitions set end_at = now() - interval '1 second' where id='${cid}'`);
v = await new Client().vote(s2, true);
ok(v.status === 409, "deadline: voting refused after end timestamp");
r = await u1.get(`/competitions/${cid}/submit`);
ok(r.html.includes("Submissions are closed"), "deadline: submission page locked");
r = await admin.get("/admin");
ok(r.html.includes("Winner approval"), "lifecycle: competition finalized, awaiting admin approval");
ok(sql(`select string_agg(submission_id || ':' || final_likes, ',' order by rank) from winners where competition_id='${cid}'`) === `${s1}:10,${s2}:2`, "lifecycle: final ranking uses eligible likes");
ok(sql(`select count(*) from winners where published_at is not null`) === "0" && !(await new Client().get("/winners")).html.includes("Test User 1"), "results: hidden until approved");
await admin.get("/admin");
ok(sql(`select count(*) from winners where competition_id='${cid}'`) === "2", "lifecycle: re-running the job creates no duplicates");
r = await admin.form("/admin", "lucide-trophy", {});
r = await new Client().get("/winners");
ok(r.html.includes("Test User 1") && r.html.includes("5,000"), "results: published on the winners page after approval");
ok((await u1.get("/dashboard")).html.includes("Rank 1"), "dashboard: participant sees final result");

// ---- A second, still-open competition (also used for visual checks) --------
r = await admin.form("/admin/competitions/new", 'name="title"', { title: `E2E Margazhi Kolam ${stamp}`, description: "Celebrate the season with your best Kolam.", rules: "Traditional Kolam only\nOne entry per participant\nJPG, PNG or WebP up to 10 MB", prizeInfo: "", startAt: ist(new Date(Date.now() - 3600e3)), endAt: ist(new Date(Date.now() + 5 * 86400e3)), intent: "publish" }, { banner: photo });
const cid2 = sql(`select id from competitions where title like 'E2E Margazhi%' order by created_at desc limit 1`);
await u1.form(`/competitions/${cid2}`, 'name="competitionId"', {});
r = await u1.form(`/competitions/${cid2}/submit`, 'name="title"', { title: "Pongal Vazhthukkal Kolam", description: "Traditional kolam for the festival." }, { image: photo });
ok(r.status === 303, "second competition: open, registered and submitted");
const s3 = r.location?.split("/p/")[1];
for (let i = 0; i < 3; i++) await new Client().vote(s3, true);
writeFileSync("/tmp/e2e-state.json", JSON.stringify({ admin: admin.jar, u1: u1.jar, cid, cid2, s1, s3 }));

console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
