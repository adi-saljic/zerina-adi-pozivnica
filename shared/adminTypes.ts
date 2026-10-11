import type { Salutation, Side } from './schemas.js';

export interface AttendanceCounts {
  invited: number;
  attending: number;
  notAttending: number;
  noAnswer: number;
}

export interface AdminMember {
  /** name_from_guest ?? name */
  name: string;
  attending: boolean | null;
}

export interface AdminHousehold {
  householdKey: string;
  displayName: string;
  salutation: Salutation;
  side: Side;
  members: AdminMember[];
  /** Marked as sent in /admin. */
  sentAt: string | null;
  openCount: number;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  respondedAt: string | null;
  message: string | null;
  /** Canonical personal URL: <base>/<slug>-<code> */
  link: string;
}

export interface AdminSummary {
  generatedAt: string;
  deadline: string;
  isClosed: boolean;
  /** Guest counts. Household counts (sent/opened/answered) are derived from `households`. */
  totals: AttendanceCounts;
  bySide: (AttendanceCounts & { side: Side; households: number })[];
  /** Per guest table (guests.table_name); null = no table assigned yet. */
  byTable: (AttendanceCounts & { tableName: string | null })[];
  /** All households, ordered by name. */
  households: AdminHousehold[];
}
