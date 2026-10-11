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
  /** Calendar date in Sarajevo, used for the countdown. */
  dateIso: '2027-05-22',
  weekdayLabel: 'subota',
  /** Decorative short date on the invitation card. */
  dateNumeric: '22 · 05 · 2027',
  timeLabel: '18:00 (placeholder)',

  venueName: 'Restoran Nova Bentbaša',
  address: 'Bentbaša, Sarajevo',
  /** "Otvori u Google Maps" link. */
  mapUrl: 'https://maps.app.goo.gl/1ZUty9yGYdWgKxGz8',
  /**
   * Keyless Google Maps embed shown on the page (iframe). This is the final
   * /maps/embed URL: the shorter maps.google.com/maps?...&output=embed form
   * redirects through a response with X-Frame-Options: SAMEORIGIN.
   * The CSP allows it via frame-src https://www.google.com.
   */
  mapEmbedUrl:
    'https://www.google.com/maps/embed?origin=mfe&pb=!1m12!1m8!1m3!1d5753.5921187816275!2d18.4377153!3d43.8600538!3m2!1i1024!2i768!4f13.1!2m1!1sRestaurant+Nova+Bentba%C5%A1a,+Sarajevo!6i16!3m1!1sbs!5m1!1sbs',

  /**
   * RSVP deadline: ISO 8601 WITH timezone offset (summer time in Sarajevo is +02:00).
   * Without an offset the server (running in UTC) would close it at the wrong hour,
   * so the API refuses to start RSVPs with a deadline that has no offset.
   * The server env var RSVP_DEADLINE overrides this; the UI always shows the
   * deadline it gets from the API, so the two cannot drift apart.
   */
  rsvpDeadline: '2027-05-15T23:59:59+02:00',

  timeZone: 'Europe/Sarajevo',

  /**
   * Full-screen photo on the cover: a portrait crop for phones, a wide crop for
   * computers. TODO(Zerina & Adi): placeholder photo from Unsplash; replace the
   * cover-*.webp files in public/images/ with your photo, same names and sizes
   * (720×1280, 1440×2560, 1280×720, 2560×1440). index.html preloads them too.
   */
  coverImage: {
    portrait: { small: '/images/cover-720.webp', large: '/images/cover-1440.webp' },
    landscape: { small: '/images/cover-wide-1280.webp', large: '/images/cover-wide-2560.webp' },
  },

  /**
   * Background music, starts on the "Otvori pozivnicu" tap.
   * TODO(Zerina & Adi): placeholder track is "Canon in D Major" by Kevin MacLeod
   * (incompetech.com, CC BY 3.0). Replace public/audio/music.m4a, keep it under ~2 MB.
   */
  music: {
    enabled: true,
    src: '/audio/music.m4a',
  },
} as const;

export type EventConfig = typeof event;
