-- 002: personalized routes (slug), salutation, per-guest tables, placeholder members.
-- invitations.household_key already exists (added in 001), so it is not re-added here.

-- ---- invitations: salutation + slug ----------------------------------------------

alter table invitations
  add column salutation text not null default 'Dragi'
    check (salutation in ('Dragi', 'Draga')),
  add column slug text;

alter table invitations alter column salutation drop default;

-- Backfill slugs of existing rows with the same rules as shared/slug.ts
-- (the seed recomputes them anyway). The slug is cosmetic; the code is the only auth.
update invitations
set slug = trim(both '-' from regexp_replace(regexp_replace(regexp_replace(
  replace(lower(translate(display_name, 'ČĆŠŽčćšž', 'ccszccsz')), 'đ', 'dj'),
  '\s+', '-', 'g'), '[^a-z0-9-]', '', 'g'), '-{2,}', '-', 'g'));

alter table invitations alter column slug set not null;

-- ---- guests: table per guest, placeholder members --------------------------------

alter table guests
  add column table_name text null,
  add column is_placeholder boolean not null default false,
  add column name_from_guest text null
    constraint guests_name_from_guest_length check (char_length(name_from_guest) <= 60);

-- Move the seating table from the household to each of its guests.
update guests as g
set table_name = i.table_name
from invitations as i
where i.id = g.invitation_id;

drop index if exists invitations_table_name_idx;
alter table invitations drop column table_name;

create index guests_table_name_idx on guests (table_name);
