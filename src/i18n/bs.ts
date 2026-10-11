// All user-facing texts (Bosnian) in one place. Change wording here only.
// Also used by the build (og: tags) and scripts/export-links.ts (WhatsApp text),
// so keep it free of browser APIs; the ".js" import extension is for Node.
import { event } from '../config/event.js';
import type { Role, Salutation, Side } from '../../shared/schemas.js';

const roles: Record<Role, string> = {
  muz: 'muž',
  zena: 'žena',
  partner: 'partner',
  dijete: 'dijete',
  gost: 'gost',
};

const sides: Record<Side, string> = {
  zerina: 'Zerina',
  adi: 'Adi',
  zajednicki: 'Zajednički',
};

/** Shown instead of a placeholder name ("Ljubo +1", "Zokino dijete 1"). */
const placeholderLabels: Record<Role, string> = {
  partner: 'Pratnja',
  dijete: 'Dijete',
  muz: 'Gost',
  zena: 'Gost',
  gost: 'Gost',
};

const months = [
  'januar',
  'februar',
  'mart',
  'april',
  'maj',
  'juni',
  'juli',
  'august',
  'septembar',
  'oktobar',
  'novembar',
  'decembar',
] as const;

export const bs = {
  /** "15. maj 2027. u 23:59" */
  dateTime: (p: { day: number; month: number; year: number; time: string }) =>
    `${p.day}. ${months[p.month - 1] ?? p.month} ${p.year}. u ${p.time}`,

  og: {
    title: `${event.coupleNames} · ${event.dateLabel}`,
    description: 'Pozivnica na naše vjenčanje. Otvorite link i potvrdite dolazak.',
    imageAlt: `${event.coupleNames}, ${event.dateLabel}`,
  },

  documentTitle: `${event.coupleNames} · pozivnica`,

  loading: 'Učitavamo vašu pozivnicu…',

  invalid: {
    title: 'Ovaj link ne radi',
    body: 'Pozivnicu nismo pronašli. Provjerite da ste otvorili cijeli link iz poruke.',
    contact: 'Ako i dalje ne radi, javite se Zerini ili Adiju.',
  },

  /** Step names in the progress indicator (the envelope is not counted). */
  steps: {
    invitation: 'Pozivnica',
    details: 'Gdje i kada',
    rsvp: 'Potvrda',
    message: 'Poruka',
    progress: (n: number, total: number) => `Korak ${n} od ${total}`,
    next: 'Dalje',
    back: 'Nazad',
  },

  cover: {
    eyebrow: 'Pozivnica za',
    greeting: (salutation: Salutation, displayName: string) => `${salutation} ${displayName}`,
    open: 'Otvori pozivnicu',
    photoAlt: `${event.brideName} i ${event.groomName}`,
  },

  music: {
    play: 'Pusti muziku',
    pause: 'Pauziraj muziku',
  },

  invitation: {
    /** "Dragi Zoka i Danijela," / "Draga Fatima," */
    greeting: (salutation: Salutation, displayName: string) => `${salutation} ${displayName},`,
    invite: 'S radošću vas pozivamo na naše vjenčanje',
    body: 'Bit će nam veliko zadovoljstvo da ovaj dan provedete s nama.',
    /** "Do vjenčanja još 223 dana" */
    countdown: (days: number) => {
      const unit = days % 10 === 1 && days % 100 !== 11 ? 'dan' : 'dana';
      return `Do vjenčanja još ${days} ${unit}`;
    },
    today: 'Danas je naš dan!',
    alreadyResponded: 'Već ste nam odgovorili. Odgovor možete izmijeniti do roka.',
  },

  event: {
    heading: 'Gdje i kada',
    date: 'Datum',
    time: 'Vrijeme',
    venue: 'Mjesto',
    address: 'Adresa',
    map: 'Otvori u Google Maps',
    mapTitle: `Karta: ${event.venueName}`,
  },

  form: {
    heading: 'Potvrda dolaska',
    deadline: (date: string) => `Molimo vas da odgovorite do ${date}.`,
    attending: 'Dolazi',
    notAttending: 'Ne dolazi',
    placeholderName: 'Ime (nije obavezno)',
    messageHeading: 'Poruka za mladence',
    messageLabel: 'Želite li nam nešto poručiti? (nije obavezno)',
    summary: 'Vaš odgovor',
    charactersLeft: (n: number) => `Preostalo znakova: ${n}`,
    save: 'Spasi',
    answerEveryone: 'Označite odgovor za svaku osobu da biste mogli nastaviti.',
  },

  saving: 'Spašavamo vaš odgovor…',

  saved: {
    title: 'Hvala!',
    subtitle: 'Vaš odgovor je spašen.',
    seeYou: "Radujemo se što ćemo se vidjeti!",
    coming: 'Dolaze',
    notComing: 'Ne dolaze',
    nobodyComing: 'Žao nam je što nećete moći doći. Hvala što ste nam javili.',
    yourMessage: 'Vaša poruka',
    edit: 'Izmijeni odgovor',
    canEditUntil: (date: string) => `Odgovor možete mijenjati do ${date}.`,
  },

  closed: {
    title: 'Rok za odgovor je istekao',
    body: (date: string) =>
      `Odgovore smo primali do ${date}. Ako se nešto promijenilo, javite se Zerini ili Adiju.`,
    yourAnswers: 'Vaši odgovori',
    noAnswer: 'bez odgovora',
  },

  error: {
    title: 'Nešto nije u redu',
    load: 'Nismo uspjeli učitati pozivnicu. Provjerite internet vezu i pokušajte ponovo.',
    save: 'Odgovor nije spašen. Vaši odabiri su sačuvani, pa samo pokušajte ponovo.',
    rateLimited: 'Previše pokušaja u kratkom vremenu. Sačekajte par minuta i pokušajte ponovo.',
    retry: 'Pokušaj ponovo',
    back: 'Nazad na odgovore',
  },

  whatsapp: {
    invite: (p: { salutation: Salutation; displayName: string; url: string }) =>
      `${p.salutation} ${p.displayName}, ${event.brideName} i ${event.groomName} se vjenčavaju ` +
      `i bilo bi nam drago da budete s nama 💍 Ovdje je vaša pozivnica i potvrda dolaska: ${p.url}`,
  },

  admin: {
    title: 'Pregled gostiju',
    tokenLabel: 'Admin token',
    remember: 'Zapamti na ovom uređaju',
    login: 'Prikaži',
    logout: 'Odjavi se',
    refresh: 'Osvježi',
    downloadCsv: 'CSV (Excel)',
    loading: 'Učitavanje…',
    wrongToken: 'Token nije ispravan.',
    unavailable: 'Admin nije dostupan (token nije podešen na serveru).',
    failed: 'Nije uspjelo. Pokušajte ponovo.',
    generatedAt: (date: string) => `Stanje: ${date}`,
    deadline: (date: string, closed: boolean) => `Rok: ${date}${closed ? ' (istekao)' : ''}`,

    // Stat tiles
    guests: 'Gostiju',
    attending: 'Dolazi',
    notAttending: 'Ne dolazi',
    noAnswer: 'Bez odgovora',
    sent: 'Poslano',
    opened: 'Otvorilo',
    answered: 'Odgovorilo',
    ofHouseholds: (total: number) => `od ${total} domaćinstava`,

    // Household list
    households: 'Domaćinstva',
    search: 'Traži ime',
    filterAll: 'Sva',
    filterToSend: 'Za poslati',
    filterWaiting: 'Poslano, nije otvoreno',
    filterOpened: 'Otvorili, bez odgovora',
    filterAnswered: 'Odgovorili',
    sideAll: 'Obje strane',
    noMatches: 'Nijedno domaćinstvo ne odgovara filteru.',
    statusNew: 'Nije poslano',
    statusSent: 'Poslano',
    statusOpened: 'Otvoreno',
    statusAnswered: 'Odgovorili',
    partial: 'novi gost bez odgovora',
    sentFor: (name: string) => `Poslano: ${name}`,
    sentOn: (date: string) => `Poslano ${date}`,
    notOpened: 'nije otvoreno',
    openedInfo: (count: number, date: string) => `otvoreno ${count}× · ${date}`,
    answeredOn: (date: string) => `odgovor ${date}`,
    memberAttending: 'dolazi',
    memberNotAttending: 'ne dolazi',
    memberNoAnswer: 'bez odgovora',
    copyMessage: 'Poruka',
    copyMessageLabel: (name: string) => `Kopiraj WhatsApp poruku za: ${name}`,
    copyLink: 'Link',
    copyLinkLabel: (name: string) => `Kopiraj link za: ${name}`,
    whatsapp: 'WhatsApp',
    whatsappLabel: (name: string) => `Otvori WhatsApp sa porukom za: ${name}`,
    copied: 'Kopirano ✓',

    // Side panels
    bySide: 'Po strani',
    byTable: 'Po stolu',
    side: 'Strana',
    table: 'Sto',
    noTable: 'bez stola',
    householdsShort: 'Dom.',
    invitedShort: 'Pozv.',
    messages: 'Poruke gostiju',
    none: 'Nema.',
  },

  roles,
  sides,
  placeholderLabels,
} as const;
