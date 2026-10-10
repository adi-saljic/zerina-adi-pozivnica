import type { Side } from './schemas.js';

export interface AttendanceCounts {
  invited: number;
  attending: number;
  notAttending: number;
  noAnswer: number;
}

export interface HouseholdBrief {
  displayName: string;
  householdKey: string;
  side: Side;
  tableName: string | null;
  guests: number;
  unanswered: number;
  openCount: number;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  respondedAt: string | null;
  link: string;
}

export interface AdminSummary {
  generatedAt: string;
  deadline: string;
  isClosed: boolean;
  totals: AttendanceCounts & {
    households: number;
    householdsOpened: number;
    householdsResponded: number;
  };
  bySide: (AttendanceCounts & { side: Side; households: number })[];
  /** tableName null = no table assigned yet. */
  byTable: (AttendanceCounts & { tableName: string | null })[];
  notResponded: HouseholdBrief[];
  notOpened: HouseholdBrief[];
  /** Responded, but a guest was added later and has no answer yet. */
  partiallyAnswered: HouseholdBrief[];
  messages: { displayName: string; message: string; respondedAt: string | null }[];
}
