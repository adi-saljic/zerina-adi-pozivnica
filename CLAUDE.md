# CLAUDE.md

Online wedding invitation + RSVP for **Zerina & Adi** (22. maj 2027., Restoran Nova Bentbaša, Sarajevo).
Vite + React + TS (strict) · Vercel Functions in `api/` · Neon Postgres · zod · vitest. See README.md
for setup and operations. UI texts are Bosnian, code and comments English.

## Commands

```bash
npm run dev            # Vite + local /api (no Vercel login); vercel:dev = real Vercel runtime
npm run typecheck && npm run lint && npm run test   # must pass before every commit
npm run build && npm run check:bundle               # no secret may end up in dist/
npm run db:migrate | db:seed [-- --dry-run|--prune] | links:export
```

## Rules

### Routing: the code is the only auth, the slug is cosmetic

- Personal URL: `/<slug>-<code>`, e.g. `/zoka-i-danijela-k7x2p9Qa3m`. The **code** (10 chars base58,
  `crypto.randomBytes`) is the last part after the final `-` and the **only** thing that identifies and
  authorizes a household. Never use the slug for lookups or authorization.
- The slug comes from `display_name` (`shared/slug.ts`: lower case, č/ć→c, š→s, ž→z, đ→dj, spaces→`-`,
  only `a-z0-9-`). It may change. A wrong or outdated slug must still load, and the page then calls
  `history.replaceState` to the canonical URL. **Old links must never break.**
- `/?g=CODE`, `/p/CODE` and `/CODE` stay supported and are canonicalized client-side
  (`src/lib/invitationUrl.ts`).
- `vercel.json` rewrites every path without a dot that is not `/api/*` to `index.html`. Static files
  (dots) are excluded, so `/preview.jpg` etc. are never swallowed. The og: tags are static in
  `index.html` and identical for every household.
- Unknown and malformed codes get the same generic 404. No public endpoint lists households or guests.

### Seed safety (`scripts/seed.ts`, `scripts/lib/seedPlan.ts`)

- Households are matched by `household_key`, guests within a household by `sort_order`.
  `sort_order` is the guest's identity: add new members at the end, don't renumber after links are sent.
- The seed **never writes** `attending`, `message`, `name_from_guest`, `code`, `sent_at` (set in
  /admin), or the open/response timestamps. Codes are generated once. A changed `display_name` only updates `slug`.
- Rows missing from the CSV are only reported. Deleting needs `--prune`, which lists what it would delete
  and asks for confirmation. Opened/answered ones also need `--force`.
- `data/households.csv` is the real guest list. It is gitignored and must stay that way (also `out/`
  and `.env`).

### Other

- Relative imports in `api/` and `shared/` **must end in `.js`** (Vercel runs ESM without bundling).
  `npm run typecheck` (NodeNext) enforces it. `shared/` must stay free of browser/Node-only APIs.
- `DATABASE_URL` / `ADMIN_TOKEN` are server-only: never `VITE_`-prefixed, never imported in `src/`
  (ESLint blocks it).
- Placeholder members (`is_placeholder`): the page shows a label ("Pratnja", "Dijete", else "Gost"),
  never the placeholder text, plus an optional name field. The API accepts `name` only for
  placeholders (trimmed, ≤ 60 chars, no control chars) and stores it in `guests.name_from_guest`.
  `guests.name` is never overwritten by guest input. Admin/export show `name_from_guest ?? name`.
- All texts are in `src/i18n/bs.ts`, event details in `shared/event.ts`. **Name order is always
  "Zerina i Adi" / "Zerina & Adi" / "Zerini ili Adiju", never Adi first.**
- Styling lives only in `src/styles/tokens.css` and `*.module.css`. Logic (hooks, API client) is
  separate from presentational components. Don't restyle when changing data/logic.
- Migrations: add a new numbered file in `db/migrations/`. Never edit an applied one.
- The tool environment may turn `\uXXXX` escapes into literal characters when writing files. Use
  literal letters, `String.fromCharCode`, `.normalize('NFD')` or `\p{...}` classes instead, and grep
  for invisible characters after writing.
