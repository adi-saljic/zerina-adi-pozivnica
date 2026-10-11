import { event } from '../config/event';
import { bs } from '../i18n/bs';

// Only numbers come from Intl (with the Sarajevo time zone); month names and
// word order come from bs.ts. Browsers on many phones ship without Bosnian
// locale data and would otherwise print something like "2027 M05 15".
const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: event.timeZone,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** "15. maj 2027. u 23:59", always in Sarajevo time regardless of the phone's zone. */
export function formatDateTime(iso: string): string {
  const all = parts.formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => all.find((p) => p.type === type)?.value ?? '';
  return bs.dateTime({
    day: Number(get('day')),
    month: Number(get('month')),
    year: Number(get('year')),
    time: `${get('hour')}:${get('minute')}`,
  });
}

/** "11.10. 20:15" (Sarajevo time), for the admin tables. */
export function formatShortDateTime(iso: string): string {
  const all = parts.formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => all.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}. ${get('hour')}:${get('minute')}`;
}

/** Whole days from today (Sarajevo) until a calendar date like "2027-05-22"; never negative. */
export function daysUntil(dateIso: string, now: Date = new Date()): number {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: event.timeZone }).format(now); // YYYY-MM-DD
  const ms = Date.parse(`${dateIso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000));
}
