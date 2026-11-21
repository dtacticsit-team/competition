# Kolam Competition Platform

A mobile-first platform for traditional Kolam competitions: participants register, upload one
Kolam, share it, and collect public likes. The most-liked entries win. English and Tamil throughout.

## What's included

| Area | Details |
| --- | --- |
| Public site | Social feed of Kolams, competition pages with countdown, live leaderboard, post pages with WhatsApp / Facebook / copy-link sharing and Open Graph previews, winners page, sponsors |
| Accounts | Register (name, email, mobile, password), login, logout, forgot/reset password, email verification, profile with photo |
| Participation | Register for a competition, submit one Kolam (JPG/PNG/WebP ≤ 10 MB, previewed before publishing), edit or replace it until the deadline |
| Voting | Anonymous likes, one per visitor per entry, unlike, rate limiting, burst flagging, audit trail, admin review |
| Lifecycle | Registration, submission and voting open together at `startAt` and close together at `endAt` (server clock). Results are ranked automatically and published only after admin approval |
| Admin | Three sections — Dashboard (stats, competition setup, winner approval, flagged votes), Sponsors, Prize settings — plus a Design references tool |
| Languages | English (default) and Tamil, switcher in the header, choice persisted in a cookie |

## Stack

- Next.js 16 (App Router, Server Actions) + TypeScript + Tailwind CSS 4
- PostgreSQL via Drizzle ORM
- Zod for validation, sharp for image processing

### Differences from the original brief

The project template this was built on fixes some choices, and a few services need credentials that
were not available. These are deliberate substitutions, not placeholders:

| Brief | Implemented | Why |
| --- | --- | --- |
| Prisma | Drizzle ORM | The project template is wired for Drizzle. Same models, constraints and indexes (`src/db/schema.ts`). |
| Auth.js | Built-in session auth (`src/lib/auth.ts`) | scrypt password hashes, httpOnly SameSite cookies, only token hashes stored in the DB. |
| next-intl | Small typed i18n layer (`src/lib/i18n*.ts`) | Same `messages/en.json` + `messages/ta.json` layout. A missing Tamil key is a compile error. |
| shadcn/ui | Hand-written Tailwind components (`src/components`) | Keeps the bundle small; no behavioural difference. |
| Cloudflare R2 | Images stored in PostgreSQL (`images` table) | No R2 credentials were available. All writes go through `src/lib/storage.ts`, and reads through `src/app/api/images/[id]/route.ts`, so swapping in R2 touches two files. |

## Local setup

```bash
cp .env.example .env          # then edit values
npm install
npx drizzle-kit push          # create/update tables
node scripts/seed-admin.mjs   # create the competition-creator admin from ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev                   # http://localhost:3000
```

### Environment variables

See `.env.example`. Only `DATABASE_URL` is required. In production also set:

- `NEXT_PUBLIC_SITE_URL` — public origin, used in share links, Open Graph tags and the sitemap.
- `AUTH_SECRET` — random string that salts the stored IP hashes.
- `ADMIN_EMAILS` — comma-separated admin emails.
<<<<<<< HEAD
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` — to send verification and reset emails via Nodemailer SMTP.
=======
- `RESEND_API_KEY` + `MAIL_FROM` — to actually send verification and reset emails.
>>>>>>> 459f73a5be8e0df71161d2155bc61f3e71d49e2b

### The admin (competition creator) account

The admin is created from two values in `.env`:

```
ADMIN_EMAIL=admin@kolam.test
ADMIN_PASSWORD=Kolam-Admin-2026!     # at least 8 characters
```

Run `node scripts/seed-admin.mjs` once after `npx drizzle-kit push`. The script creates the account,
or updates its password if you run it again after changing `.env`. Then log in at `/login` with that
email and password. Admins see the **Admin** button in the header and can open `/admin` to create,
publish and cancel competitions, manage sponsors, set prizes and approve results.

**Change `ADMIN_PASSWORD` to your own strong password before deploying.** The value in the
development `.env` is only for local testing.

Other admin rules:

- Emails listed in `ADMIN_EMAILS` are granted the admin role at registration or next login.
- If `ADMIN_EMAILS` is not set, the first account ever registered becomes the admin. Use the seed
  script instead on any public deployment.

## How the competition lifecycle works

- A competition is `draft` → `published` → `closed` (or `cancelled`).
- While published, everything is open exactly when `startAt <= now < endAt` on the server.
  There is no separate "registration open" flag that could drift. The browser clock is never trusted.
- Admin date inputs are interpreted as IST (Asia/Kolkata); the database stores UTC.
- A scheduler (`src/lib/scheduler.ts`, started from `src/instrumentation.ts`) runs every 30 seconds.
  For each competition past its deadline it locks the row, ranks entries by eligible likes
  (ties: earlier submission wins), stores the top three with the prize amounts in force, and marks the
  competition closed. The job is idempotent, and pages also trigger it on load, so results are correct
  even right after a restart.
- Results stay private until an admin clicks **Approve & publish results**.
- Optional external trigger: set `CRON_SECRET` and
  `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-site/api/cron`.

## Voting and fraud prevention

Anonymous browser voting cannot guarantee one vote per human. The platform applies reasonable limits:

- Unique database index on (entry, visitor id); the visitor id is a server-issued httpOnly cookie.
- 30 vote actions per minute per IP address.
- Per entry, likes from one IP in 24 h are **flagged** from the 10th (`VOTE_FLAG_THRESHOLD`) and
  **refused** from the 50th (`VOTE_IP_CAP`).
- Flagged likes still count until an admin excludes them on the dashboard; excluding re-ranks
  a finished competition as long as its results are not yet published.
- Every like, unlike, flag and block is appended to `vote_events`; admin actions go to `audit_logs`.
- Raw IP addresses are never stored, only salted hashes.

Rate limits are held in memory, which suits one server process. Run a single instance, or move
`src/lib/rate-limit.ts` to Redis first. Put the app behind a reverse proxy that sets
`X-Forwarded-For` and `X-Forwarded-Proto`; without them every visitor shares one rate-limit bucket.

## Design references

`/admin/references` lets an admin upload multiple reference images per application section
(homepage, feed, post page, auth, participant dashboard, admin dashboard, sponsors, competition
pages, mobile layouts), preview them, add a note, move them between sections, replace and remove them.
They are design guidance only and never affect the live site or its data.

## Translations

All interface text lives in `messages/en.json` and `messages/ta.json`. User-generated content
(names, titles, descriptions, rules) is shown as written. To add a string, add the key to both files
and use `t("section.key")`; TypeScript rejects unknown keys.

## Production

Point `DATABASE_URL` at PostgreSQL, run `npx drizzle-kit push` once to create the tables, then:

```bash
npm run build
npm run start
```

Images live in the database along with the rest of the data — back that up. Put a reverse proxy in
front for TLS.

## Testing

`scripts/e2e.mjs` drives the real forms and APIs end to end (accounts, competition setup,
registration, uploads, voting, moderation, deadline, ranking, approval):

```bash
npm run build && npm run start &
node scripts/e2e.mjs        # creates test data — use a disposable database
```

It sends everything from one address, so running it more than twice against the same server
process trips the registration rate limit; restart the server between runs.

## Project layout

```
messages/               en.json, ta.json
src/db/schema.ts        tables, constraints, indexes
src/lib/                auth, i18n, storage, competitions (lifecycle), queries, rate-limit, scheduler
src/app/actions/        server actions: auth, competition (register/submit), admin
src/app/api/            vote, feed, images, cron, health
src/app/(site)/         public pages, dashboard, auth pages
src/app/admin/          dashboard, competition form, sponsors, prizes, references
src/components/         shared UI
```
