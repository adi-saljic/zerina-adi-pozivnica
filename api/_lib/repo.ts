// All SQL lives here. Every value goes through sql`...` interpolation, which the
// Neon driver sends as bind parameters (never string-concatenated).

import type {
  AdminHousehold,
  AdminMember,
  AdminSummary,
  AttendanceCounts,
} from '../../shared/adminTypes.js';
import type { GuestDto, Role, RsvpResponseItem, Salutation, Side } from '../../shared/schemas.js';
import { invitationPath } from '../../shared/slug.js';
import { db, toIso } from './db.js';

export interface Household {
  id: string;
  salutation: Salutation;
  displayName: string;
  slug: string;
  message: string | null;
  respondedAt: string | null;
  guests: GuestDto[];
}

interface HouseholdRow {
  id: string;
  salutation: Salutation;
  display_name: string;
  slug: string;
  message: string | null;
  responded_at: Date | string | null;
  guests: GuestDto[];
}

function toHousehold(row: HouseholdRow): Household {
  return {
    id: row.id,
    salutation: row.salutation,
    displayName: row.display_name,
    slug: row.slug,
    message: row.message,
    respondedAt: toIso(row.responded_at),
    guests: row.guests.map((g) => ({
      id: g.id,
      name: g.name,
      role: g.role,
      attending: g.attending,
      isPlaceholder: g.isPlaceholder,
      nameFromGuest: g.nameFromGuest,
    })),
  };
}

// Constant SQL text (no user input), shared by the household queries below.
// Expects the invitation to be aliased as `i`.
const GUESTS_JSON = `
  coalesce((
    select json_agg(json_build_object(
      'id', g.id, 'name', g.name, 'role', g.role, 'attending', g.attending,
      'isPlaceholder', g.is_placeholder, 'nameFromGuest', g.name_from_guest
    ) order by g.sort_order, g.name)
    from guests g where g.invitation_id = i.id
  ), '[]'::json) as guests`;

/** Looks up a household by code and records the visit (first/last opened, count). */
export async function openInvitation(code: string): Promise<Household | null> {
  const sql = db();
  const rows = await sql`
    with opened as (
      update invitations
      set first_opened_at = coalesce(first_opened_at, now()),
          last_opened_at = now(),
          open_count = open_count + 1
      where code = ${code}
      returning id, salutation, display_name, slug, message, responded_at
    )
    select i.id, i.salutation, i.display_name, i.slug, i.message, i.responded_at,
      ${sql.unsafe(GUESTS_JSON)}
    from opened i`;
  const row = rows[0] as HouseholdRow | undefined;
  return row ? toHousehold(row) : null;
}

export async function findHouseholdByCode(code: string): Promise<Household | null> {
  const sql = db();
  const rows = await sql`
    select i.id, i.salutation, i.display_name, i.slug, i.message, i.responded_at,
      ${sql.unsafe(GUESTS_JSON)}
    from invitations i
    where i.code = ${code}`;
  const row = rows[0] as HouseholdRow | undefined;
  return row ? toHousehold(row) : null;
}

/**
 * Saves answers, typed-in names of placeholder members, the message and a
 * history row in one transaction, and returns the updated household.
 * Responses must already be validated against the household (validateRsvp).
 */
export async function saveRsvp(input: {
  invitationId: string;
  responses: readonly RsvpResponseItem[];
  message: string | null;
}): Promise<Household> {
  const { invitationId, responses, message } = input;
  const sql = db();
  const ids = responses.map((r) => r.guestId);
  const attending = responses.map((r) => r.attending);
  // `name` omitted = keep the stored name; "" = clear it.
  const hasName = responses.map((r) => r.name !== undefined);
  const names = responses.map((r) => r.name || null);
  const payload = JSON.stringify({ responses, message });

  const results = await sql.transaction([
    sql`
      update guests as g
      set attending = v.attending,
          name_from_guest = case when v.has_name then v.name else g.name_from_guest end,
          updated_at = now()
      from unnest(${ids}::uuid[], ${attending}::boolean[], ${hasName}::boolean[], ${names}::text[])
        as v(id, attending, has_name, name)
      where g.id = v.id and g.invitation_id = ${invitationId}`,
    sql`
      update invitations
      set message = ${message}, responded_at = now(), updated_at = now()
      where id = ${invitationId}`,
    sql`insert into rsvp_log (invitation_id, payload) values (${invitationId}, ${payload}::jsonb)`,
    sql`
      select i.id, i.salutation, i.display_name, i.slug, i.message, i.responded_at,
        ${sql.unsafe(GUESTS_JSON)}
      from invitations i
      where i.id = ${invitationId}`,
  ]);

  const row = results[3]?.[0] as HouseholdRow | undefined;
  if (!row) throw new Error(`invitation ${invitationId} disappeared during save`);
  return toHousehold(row);
}

// ---- Admin --------------------------------------------------------------------

interface CountsRow {
  invited: number;
  attending: number;
  not_attending: number;
  no_answer: number;
}

const counts = (r: CountsRow): AttendanceCounts => ({
  invited: r.invited,
  attending: r.attending,
  notAttending: r.not_attending,
  noAnswer: r.no_answer,
});

interface HouseholdSummaryRow {
  code: string;
  slug: string;
  household_key: string;
  display_name: string;
  salutation: Salutation;
  side: Side;
  message: string | null;
  sent_at: Date | string | null;
  open_count: number;
  first_opened_at: Date | string | null;
  last_opened_at: Date | string | null;
  responded_at: Date | string | null;
  members: AdminMember[];
}

export function invitationUrl(baseUrl: string, slug: string, code: string): string {
  return `${baseUrl}${invitationPath(slug, code)}`;
}

export async function adminSummary(input: {
  baseUrl: string;
  deadline: Date;
  isClosed: boolean;
}): Promise<AdminSummary> {
  const sql = db();
  const [totalRows, sideRows, tableRows, householdRows] = await sql.transaction(
    [
      sql`
        select count(*)::int as invited,
          count(*) filter (where attending)::int as attending,
          count(*) filter (where attending = false)::int as not_attending,
          count(*) filter (where attending is null)::int as no_answer
        from guests`,
      sql`
        select i.side,
          count(distinct i.id)::int as households,
          count(g.id)::int as invited,
          count(g.id) filter (where g.attending)::int as attending,
          count(g.id) filter (where g.attending = false)::int as not_attending,
          count(g.id) filter (where g.id is not null and g.attending is null)::int as no_answer
        from invitations i left join guests g on g.invitation_id = i.id
        group by i.side
        order by array_position(array['zerina', 'adi', 'zajednicki'], i.side)`,
      // Seating is per guest: kids of one household can sit at the kids' table.
      sql`
        select g.table_name,
          count(*)::int as invited,
          count(*) filter (where g.attending)::int as attending,
          count(*) filter (where g.attending = false)::int as not_attending,
          count(*) filter (where g.attending is null)::int as no_answer
        from guests g
        group by g.table_name order by g.table_name nulls last`,
      sql`
        select i.code, i.slug, i.household_key, i.display_name, i.salutation, i.side, i.message,
          i.sent_at, i.open_count, i.first_opened_at, i.last_opened_at, i.responded_at,
          coalesce(
            json_agg(
              json_build_object('name', coalesce(g.name_from_guest, g.name), 'attending', g.attending)
              order by g.sort_order
            ) filter (where g.id is not null),
            '[]'
          ) as members
        from invitations i left join guests g on g.invitation_id = i.id
        group by i.id order by i.display_name, i.household_key`,
    ],
    { readOnly: true },
  );

  const totals = (totalRows?.[0] ?? {
    invited: 0,
    attending: 0,
    not_attending: 0,
    no_answer: 0,
  }) as CountsRow;

  return {
    generatedAt: new Date().toISOString(),
    deadline: input.deadline.toISOString(),
    isClosed: input.isClosed,
    totals: counts(totals),
    bySide: ((sideRows ?? []) as (CountsRow & { side: Side; households: number })[]).map((r) => ({
      side: r.side,
      households: r.households,
      ...counts(r),
    })),
    byTable: ((tableRows ?? []) as (CountsRow & { table_name: string | null })[]).map((r) => ({
      tableName: r.table_name,
      ...counts(r),
    })),
    households: ((householdRows ?? []) as HouseholdSummaryRow[]).map(
      (h): AdminHousehold => ({
        householdKey: h.household_key,
        displayName: h.display_name,
        salutation: h.salutation,
        side: h.side,
        members: h.members,
        sentAt: toIso(h.sent_at),
        openCount: h.open_count,
        firstOpenedAt: toIso(h.first_opened_at),
        lastOpenedAt: toIso(h.last_opened_at),
        respondedAt: toIso(h.responded_at),
        message: h.message,
        link: invitationUrl(input.baseUrl, h.slug, h.code),
      }),
    ),
  };
}

/** Marks a household as sent (keeps the first time) or clears it. Null if the key is unknown. */
export async function setHouseholdSent(
  householdKey: string,
  sent: boolean,
): Promise<{ sentAt: string | null } | null> {
  const rows = await db()`
    update invitations
    set sent_at = case when ${sent} then coalesce(sent_at, now()) else null end
    where household_key = ${householdKey}
    returning sent_at`;
  const row = rows[0] as { sent_at: Date | string | null } | undefined;
  return row ? { sentAt: toIso(row.sent_at) } : null;
}

export interface ExportRow {
  household: string;
  household_key: string;
  side: Side;
  code: string;
  slug: string;
  table_name: string | null;
  /** The name a guest typed for a placeholder member, otherwise the name from the CSV. */
  guest_name: string;
  role: Role;
  is_placeholder: boolean;
  attending: boolean | null;
  responded_at: Date | string | null;
  message: string | null;
}

export async function exportGuests(): Promise<ExportRow[]> {
  const rows = await db()`
    select i.display_name as household, i.household_key, i.side, i.code, i.slug, g.table_name,
      coalesce(g.name_from_guest, g.name) as guest_name, g.role, g.is_placeholder,
      g.attending, i.responded_at, i.message
    from guests g join invitations i on i.id = g.invitation_id
    order by array_position(array['zerina', 'adi', 'zajednicki'], i.side),
      i.display_name, i.household_key, g.sort_order`;
  return rows as ExportRow[];
}
