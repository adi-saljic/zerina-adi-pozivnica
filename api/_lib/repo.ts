// All SQL lives here. Every value goes through sql`...` interpolation, which the
// Neon driver sends as bind parameters (never string-concatenated).

import type { AdminSummary, AttendanceCounts, HouseholdBrief } from '../../shared/adminTypes.js';
import type { GuestDto, RsvpResponseItem, Role, Side } from '../../shared/schemas.js';
import { db, toIso } from './db.js';

export interface Household {
  id: string;
  displayName: string;
  message: string | null;
  respondedAt: string | null;
  guests: GuestDto[];
}

interface HouseholdRow {
  id: string;
  display_name: string;
  message: string | null;
  responded_at: Date | string | null;
  guests: { id: string; name: string; role: Role; attending: boolean | null }[];
}

function toHousehold(row: HouseholdRow): Household {
  return {
    id: row.id,
    displayName: row.display_name,
    message: row.message,
    respondedAt: toIso(row.responded_at),
    guests: row.guests.map((g) => ({
      id: g.id,
      name: g.name,
      role: g.role,
      attending: g.attending,
    })),
  };
}

/** Looks up a household by code and records the visit (first/last opened, count). */
export async function openInvitation(code: string): Promise<Household | null> {
  const rows = await db()`
    with opened as (
      update invitations
      set first_opened_at = coalesce(first_opened_at, now()),
          last_opened_at = now(),
          open_count = open_count + 1
      where code = ${code}
      returning id, display_name, message, responded_at
    )
    select o.id, o.display_name, o.message, o.responded_at,
      coalesce((
        select json_agg(json_build_object(
          'id', g.id, 'name', g.name, 'role', g.role, 'attending', g.attending
        ) order by g.sort_order, g.name)
        from guests g where g.invitation_id = o.id
      ), '[]'::json) as guests
    from opened o`;
  const row = rows[0] as HouseholdRow | undefined;
  return row ? toHousehold(row) : null;
}

export async function findHouseholdByCode(code: string): Promise<Household | null> {
  const rows = await db()`
    select i.id, i.display_name, i.message, i.responded_at,
      coalesce((
        select json_agg(json_build_object(
          'id', g.id, 'name', g.name, 'role', g.role, 'attending', g.attending
        ) order by g.sort_order, g.name)
        from guests g where g.invitation_id = i.id
      ), '[]'::json) as guests
    from invitations i
    where i.code = ${code}`;
  const row = rows[0] as HouseholdRow | undefined;
  return row ? toHousehold(row) : null;
}

/**
 * Saves answers, message and a history row in one transaction and returns the
 * updated household. Responses must already be validated against the household.
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
  const payload = JSON.stringify({ responses, message });

  const results = await sql.transaction([
    sql`
      update guests as g
      set attending = v.attending, updated_at = now()
      from unnest(${ids}::uuid[], ${attending}::boolean[]) as v(id, attending)
      where g.id = v.id and g.invitation_id = ${invitationId}`,
    sql`
      update invitations
      set message = ${message}, responded_at = now(), updated_at = now()
      where id = ${invitationId}`,
    sql`insert into rsvp_log (invitation_id, payload) values (${invitationId}, ${payload}::jsonb)`,
    sql`
      select i.id, i.display_name, i.message, i.responded_at,
        coalesce((
          select json_agg(json_build_object(
            'id', g.id, 'name', g.name, 'role', g.role, 'attending', g.attending
          ) order by g.sort_order, g.name)
          from guests g where g.invitation_id = i.id
        ), '[]'::json) as guests
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
  household_key: string;
  display_name: string;
  side: Side;
  table_name: string | null;
  message: string | null;
  open_count: number;
  first_opened_at: Date | string | null;
  last_opened_at: Date | string | null;
  responded_at: Date | string | null;
  guests: number;
  unanswered: number;
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
        group by i.side order by i.side`,
      sql`
        select i.table_name,
          count(g.id)::int as invited,
          count(g.id) filter (where g.attending)::int as attending,
          count(g.id) filter (where g.attending = false)::int as not_attending,
          count(g.id) filter (where g.id is not null and g.attending is null)::int as no_answer
        from invitations i left join guests g on g.invitation_id = i.id
        group by i.table_name order by i.table_name nulls last`,
      sql`
        select i.code, i.household_key, i.display_name, i.side, i.table_name, i.message,
          i.open_count, i.first_opened_at, i.last_opened_at, i.responded_at,
          count(g.id)::int as guests,
          count(g.id) filter (where g.id is not null and g.attending is null)::int as unanswered
        from invitations i left join guests g on g.invitation_id = i.id
        group by i.id order by i.display_name`,
    ],
    { readOnly: true },
  );

  const households = (householdRows ?? []) as HouseholdSummaryRow[];
  const brief = (h: HouseholdSummaryRow): HouseholdBrief => ({
    displayName: h.display_name,
    householdKey: h.household_key,
    side: h.side,
    tableName: h.table_name,
    guests: h.guests,
    unanswered: h.unanswered,
    openCount: h.open_count,
    firstOpenedAt: toIso(h.first_opened_at),
    lastOpenedAt: toIso(h.last_opened_at),
    respondedAt: toIso(h.responded_at),
    link: `${input.baseUrl}/?g=${h.code}`,
  });

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
    totals: {
      ...counts(totals),
      households: households.length,
      householdsOpened: households.filter((h) => h.first_opened_at !== null).length,
      householdsResponded: households.filter((h) => h.responded_at !== null).length,
    },
    bySide: ((sideRows ?? []) as (CountsRow & { side: Side; households: number })[]).map((r) => ({
      side: r.side,
      households: r.households,
      ...counts(r),
    })),
    byTable: ((tableRows ?? []) as (CountsRow & { table_name: string | null })[]).map((r) => ({
      tableName: r.table_name,
      ...counts(r),
    })),
    notResponded: households.filter((h) => h.responded_at === null).map(brief),
    notOpened: households.filter((h) => h.first_opened_at === null).map(brief),
    partiallyAnswered: households
      .filter((h) => h.responded_at !== null && h.unanswered > 0)
      .map(brief),
    messages: households
      .filter((h): h is HouseholdSummaryRow & { message: string } => !!h.message)
      .map((h) => ({
        displayName: h.display_name,
        message: h.message,
        respondedAt: toIso(h.responded_at),
      })),
  };
}

export interface ExportRow {
  household: string;
  household_key: string;
  side: Side;
  table_name: string | null;
  guest_name: string;
  role: Role;
  attending: boolean | null;
  responded_at: Date | string | null;
  message: string | null;
}

export async function exportGuests(): Promise<ExportRow[]> {
  const rows = await db()`
    select i.display_name as household, i.household_key, i.side, i.table_name,
      g.name as guest_name, g.role, g.attending, i.responded_at, i.message
    from guests g join invitations i on i.id = g.invitation_id
    order by i.side, i.display_name, g.sort_order, g.name`;
  return rows as ExportRow[];
}
