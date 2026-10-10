# Wedding invitation app: build the backend + functional skeleton

You are setting up a personalized online wedding invitation with RSVP for **Adi & Zerina**.
Every household gets a unique link. The guest opens it, sees the members of their household, marks who is coming, and presses **Spasi** (Save).

**Scope of this task:** project setup, database, API, security, data import scripts, and a *functional but unstyled* frontend.
**Out of scope:** visual design. Keep the UI plain, semantic and easy to restyle; design will be done later.

Before writing code, give me a short plan (files, schema, endpoints). Then implement it end to end.

---

## 1. Stack

- **Frontend:** Vite + React + TypeScript (strict mode)
- **API:** Vercel Serverless Functions in `/api` (TypeScript)
- **Database:** Neon Postgres, via `@neondatabase/serverless`
- **Validation:** `zod`, shared between frontend and API where it makes sense
- **Tests:** `vitest`
- **Package manager:** npm
- Use no ORM unless it clearly helps. Plain parameterized SQL is fine.
- Hosting: Vercel (Hobby/free). The app must also run locally with `vercel dev`.

## 2. Data model

Put migrations in `db/migrations/001_init.sql`, with a small script `npm run db:migrate` that applies them in order and records which ones have already run.

```sql
invitations
  id               uuid pk default gen_random_uuid()
  code             text unique not null   -- random, unguessable (see §4)
  display_name     text not null          -- e.g. "Zoka i Danijela"
  side             text not null check (side in ('adi','zerina','zajednicki'))
  table_name       text null              -- seating table, for later
  message          text null              -- optional note from guest to the couple
  first_opened_at  timestamptz null
  last_opened_at   timestamptz null
  open_count       int not null default 0
  responded_at     timestamptz null
  created_at       timestamptz not null default now()
  updated_at       timestamptz not null default now()

guests
  id               uuid pk default gen_random_uuid()
  invitation_id    uuid not null references invitations(id) on delete cascade
  name             text not null
  role             text not null check (role in ('muz','zena','partner','dijete','gost'))
  sort_order       int not null default 0
  attending        boolean null           -- null = not answered yet
  updated_at       timestamptz not null default now()

rsvp_log                                   -- append-only history of every save
  id               bigserial pk
  invitation_id    uuid not null references invitations(id) on delete cascade
  payload          jsonb not null          -- what was submitted
  created_at       timestamptz not null default now()
```

Add sensible indexes, e.g. `guests(invitation_id)`.

## 3. API endpoints

All responses are JSON. Validate all input with zod. Use parameterized queries only.

### `GET /api/invitation?code=XXXX`
- Returns only that household:
  `{ displayName, guests: [{ id, name, role, attending }], message, respondedAt, deadline, isClosed }`
- Updates `first_opened_at` (only if null), `last_opened_at` and `open_count`.
- Unknown or malformed code: return **404** with a generic message. Don't reveal whether the code exists.

### `POST /api/rsvp`
- Body: `{ code, responses: [{ guestId, attending: boolean }], message?: string (max 500) }`
- Server-side checks:
  - The code exists.
  - Every `guestId` belongs to that invitation.
  - Every guest of the invitation is answered: no extras, no missing.
  - The RSVP deadline has not passed.
- In one transaction: update `guests.attending`, set `invitations.message`, `responded_at` and `updated_at`, and insert a row into `rsvp_log`.
- Return the updated household (same shape as GET).
- Guests may change their answer any number of times until the deadline.

### Admin endpoints (protected)
- Require header `Authorization: Bearer <ADMIN_TOKEN>`. Compare in constant time.
- `GET /api/admin/summary` returns:
  - totals: invited, attending, not attending, not answered
  - counts per side and per table
  - list of households that haven't responded or haven't opened the link
- `GET /api/admin/export.csv` returns all guests with household, side, table, role and attending status.

## 4. Security requirements (important)

- `DATABASE_URL` and `ADMIN_TOKEN` are server-only env vars. **Never** use a `VITE_` prefix, and never import them into frontend code.
- Generate codes with `crypto.randomBytes` as **10 characters, base58** (no 0/O/I/l). Don't use sequential IDs anywhere public.
- No public endpoint may list households or guests.
- Add basic rate limiting on `GET /api/invitation` and `POST /api/rsvp` by IP. Simple in-memory or Neon-based is fine; document the limitation.
- Same-origin only: no permissive CORS.
- Add `<meta name="robots" content="noindex, nofollow">` and a `robots.txt` that disallows everything.
- Return generic error messages to the client and log details server-side.
- Keep the RSVP deadline in config, enforced on the server, not only in the UI.

## 5. Frontend (functional, unstyled)

- Read the code from the URL: `https://domain/?g=XXXX`. Also support `/p/XXXX` as an alias via a Vercel rewrite.
- UI language: **Bosnian**. Put all texts in one file, `src/i18n/bs.ts`, so wording is easy to change.
- Screen states, each as its own component:
  1. **Loading**
  2. **Invalid link:** friendly message and a hint to contact Adi or Zerina
  3. **Invitation + form:**
     - Greeting with `displayName`.
     - Event details from config (date, time, venue, map link).
     - For each guest, two explicit options, **Dolazi / Ne dolazi**. Don't use a single checkbox: "no" must be distinguishable from "not answered yet".
     - Optional message textarea.
     - A **Spasi** button, disabled until every guest is answered.
  4. **Saving**
  5. **Saved:** summary of who is coming, and a **Izmijeni odgovor** button to edit again.
  6. **Closed:** the deadline has passed, so show the answers read-only.
  7. **Error:** network or server error, with retry, and without losing what the guest already selected.
- If the household already responded, pre-fill the saved answers.
- Accessibility: proper labels, keyboard navigable, visible focus, mobile-first layout (most guests open it on a phone from WhatsApp).
- Styling: minimal. Use CSS variables in `src/styles/tokens.css` (colors, fonts, spacing) and plain CSS modules, so the design can be swapped in later without touching logic. Keep logic (hooks, API client) separate from presentational components.
- Event config lives in `src/config/event.ts`: couple names, date, time, venue, address, map URL, RSVP deadline. Use placeholders for now. The server reads the deadline from the same source or an env var. Keep the two in sync.

## 6. WhatsApp link preview

- Static Open Graph tags directly in `index.html`. Don't inject them with React.
  - `og:title`: "Adi & Zerina · {datum}"
  - `og:description`
  - `og:image`: absolute https URL
  - `og:image:width` 1200 and `og:image:height` 630
  - `og:url`
  - `twitter:card`
- Add a placeholder `public/preview.jpg`: 1200×630, **under 300 KB**.
- Document in the README how to test the preview: opengraph.xyz, the Facebook Sharing Debugger, and cache-busting with `?v=2`.

## 7. Data import & link export scripts

- `data/households.example.csv` with columns:
  `household,side,table_name,guest_name,role,sort_order`
  - Include 3 fake example households, e.g. a couple, a family with 2 kids, and a single guest.
  - The real file `data/households.csv` must be in `.gitignore`.
- `npm run db:seed` (`scripts/seed.ts`):
  - Reads the CSV and validates it with zod. Fail loudly, with the line number, on bad rows.
  - Creates invitations and guests.
  - Must be **idempotent**: re-running it after editing the CSV updates names, roles and tables, adds new guests and households, and **never overwrites existing RSVP answers or codes**.
  - Print a summary of what was created, updated or left unchanged.
  - Support `--dry-run`.
- `npm run links:export` (`scripts/export-links.ts`):
  - Writes `out/links.csv` with: household, side, link, and a ready-to-paste WhatsApp message template, e.g. *"Ćao {displayName}! 💍 Zerina i Adi se vjenčavaju… Vaša pozivnica: {link}"*.
  - `out/` must be gitignored.

## 8. Project hygiene

- `.env.example` with `DATABASE_URL`, `ADMIN_TOKEN`, `PUBLIC_BASE_URL`, `RSVP_DEADLINE`.
- ESLint and Prettier.
- `npm run typecheck`, `npm run test`.
- Tests (vitest) covering:
  - zod schemas
  - code generation (length, alphabet, uniqueness over many runs)
  - RSVP validation logic: foreign guestId rejected, missing guest rejected, deadline enforced
  - seed idempotency logic: it must not wipe answers
- A `README.md` with step-by-step setup:
  1. Create a Neon project and copy the connection string.
  2. Set up `.env` locally, then run `db:migrate`, `db:seed` and `vercel dev`.
  3. Deploy to Vercel and set env vars in the dashboard.
  4. Connect a custom domain.
  5. Export links and send them.
  6. Check responses via admin summary and CSV export.

## 9. Definition of done

- `npm run typecheck`, `npm run lint` and `npm run test` all pass.
- Locally, with the example CSV, the following works end to end:
  1. Seed.
  2. Export links.
  3. Open a link.
  4. Answer and save.
  5. Reload: the answers are pre-filled.
  6. Change the answers and save again.
  7. Admin summary shows correct counts.
- An invalid code shows the friendly error.
- A past deadline blocks saving, both on the server and in the UI.
- No secret appears anywhere in the built frontend bundle. Verify with a grep over `dist/`.
- At the end, give me a short summary of:
  - what was built
  - which commands to run
  - anything you assumed or left as a TODO
