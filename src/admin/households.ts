import type { AdminHousehold } from '../../shared/adminTypes';

/** Furthest step a household has reached. */
export type HouseholdStatus = 'new' | 'sent' | 'opened' | 'answered';

export function householdStatus(h: AdminHousehold): HouseholdStatus {
  if (h.respondedAt) return 'answered';
  if (h.firstOpenedAt) return 'opened';
  if (h.sentAt) return 'sent';
  return 'new';
}

export const FILTERS = ['all', 'toSend', 'waiting', 'opened', 'answered'] as const;
export type Filter = (typeof FILTERS)[number];

export function matchesFilter(h: AdminHousehold, filter: Filter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'toSend':
      return h.sentAt === null;
    case 'waiting':
      return h.sentAt !== null && h.firstOpenedAt === null;
    case 'opened':
      return h.firstOpenedAt !== null && h.respondedAt === null;
    case 'answered':
      return h.respondedAt !== null;
  }
}

/** Answered, but a guest added later has no answer yet. */
export function isPartiallyAnswered(h: AdminHousehold): boolean {
  return h.respondedAt !== null && h.members.some((m) => m.attending === null);
}

/** Lower case without diacritics, so "zuti" finds "Žuti" and "andj" finds "Anđelija". */
function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/đ/g, 'dj')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function matchesQuery(h: AdminHousehold, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  return [h.displayName, ...h.members.map((m) => m.name)].some((name) => fold(name).includes(q));
}
