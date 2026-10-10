-- 001_init: invitations, guests, RSVP history, rate limiting.
-- Applied by `npm run db:migrate` inside a transaction; recorded in schema_migrations.

create table invitations (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,            -- random 10-char base58, the only public identifier
  household_key    text not null unique,            -- stable id from the CSV `household` column
  display_name     text not null,                   -- e.g. "Zoka i Danijela"
  side             text not null check (side in ('adi', 'zerina', 'zajednicki')),
  table_name       text null,
  message          text null check (char_length(message) <= 500),
  first_opened_at  timestamptz null,
  last_opened_at   timestamptz null,
  open_count       int not null default 0,
  responded_at     timestamptz null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint invitations_code_format check (code ~ '^[1-9A-HJ-NP-Za-km-z]{10}$')
);

create index invitations_side_idx on invitations (side);
create index invitations_table_name_idx on invitations (table_name);

create table guests (
  id             uuid primary key default gen_random_uuid(),
  invitation_id  uuid not null references invitations (id) on delete cascade,
  name           text not null,
  role           text not null check (role in ('muz', 'zena', 'partner', 'dijete', 'gost')),
  sort_order     int not null default 0,
  attending      boolean null,                       -- null = not answered yet
  updated_at     timestamptz not null default now()
);

create index guests_invitation_id_idx on guests (invitation_id, sort_order);

-- Append-only history of every save.
create table rsvp_log (
  id             bigserial primary key,
  invitation_id  uuid not null references invitations (id) on delete cascade,
  payload        jsonb not null,
  created_at     timestamptz not null default now()
);

create index rsvp_log_invitation_id_idx on rsvp_log (invitation_id, created_at);

-- Fixed-window rate limiting. key = "<bucket>:<hmac of client IP>".
create table rate_limits (
  key           text not null,
  window_start  timestamptz not null,
  hits          int not null default 0,
  primary key (key, window_start)
);

create index rate_limits_window_start_idx on rate_limits (window_start);
