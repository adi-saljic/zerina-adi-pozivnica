// Single source of truth for event details. Imported by the browser app
// (via src/config/event.ts), the API (deadline) and the build (og: tags).
// Keep this file free of browser/Node-only APIs and of import.meta.env.
//
// Name order is always Zerina first: "Zerina & Adi", "Zerina i Adi", "Zerini ili Adiju".
// TODO(Zerina & Adi): confirm the time, the exact address and the RSVP deadline.

export const event = {
  coupleNames: 'Zerina & Adi',
  brideName: 'Zerina',
  groomName: 'Adi',

  /** Shown in the invitation, the og:title and the WhatsApp message. */
  dateLabel: '22. maj 2027.',
  timeLabel: '18:00 (placeholder)',

  venueName: 'Restoran Nova Bentbaša',
  address: 'Bentbaša, Sarajevo',
  mapUrl: 'https://maps.app.goo.gl/1ZUty9yGYdWgKxGz8',

  /**
   * RSVP deadline: ISO 8601 WITH timezone offset (summer time in Sarajevo is +02:00).
   * Without an offset the server (running in UTC) would close it at the wrong hour,
   * so the API refuses to start RSVPs with a deadline that has no offset.
   * The server env var RSVP_DEADLINE overrides this; the UI always shows the
   * deadline it gets from the API, so the two cannot drift apart.
   */
  rsvpDeadline: '2027-05-15T23:59:59+02:00',

  timeZone: 'Europe/Sarajevo',
} as const;

export type EventConfig = typeof event;
