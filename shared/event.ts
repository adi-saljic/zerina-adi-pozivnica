// Single source of truth for event details. Imported by the browser app
// (via src/config/event.ts), the API (deadline) and the build (og: tags).
// Keep this file free of browser/Node-only APIs and of import.meta.env.
//
// TODO(Adi & Zerina): replace the placeholders with the real details.

export const event = {
  coupleNames: 'Adi & Zerina',
  groomName: 'Adi',
  brideName: 'Zerina',

  /** Shown in the invitation, the og:title and the WhatsApp message. */
  dateLabel: '12. juni 2027.',
  timeLabel: '18:00',

  venueName: 'Naziv sale (placeholder)',
  address: 'Ulica i broj, Sarajevo (placeholder)',
  mapUrl: 'https://maps.google.com/?q=Sarajevo',

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
