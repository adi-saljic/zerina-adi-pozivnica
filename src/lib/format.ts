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
