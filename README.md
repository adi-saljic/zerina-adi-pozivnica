# Pozivnica · Adi & Zerina

Online pozivnica sa potvrdom dolaska (RSVP). Svako domaćinstvo dobija svoj link
(`https://domena/?g=XXXXXXXXXX` ili `/p/XXXXXXXXXX`). Gost vidi članove svog
domaćinstva, za svakog označi **Dolazi / Ne dolazi**, može ostaviti poruku i klikne
**Spasi**. Odgovor može mijenjati do roka. Vi pratite odgovore na `/admin`.

**Stack:** Vite + React + TypeScript · Vercel Functions (`api/`) · Neon Postgres · zod · vitest

UI je namjerno nestiliziran. Dizajn se radi kasnije, vidi [Dizajn](#dizajn).

---

## 1. Neon baza

1. Napravi besplatan projekat na [neon.com](https://neon.com), regija **AWS Europe Central 1 (Frankfurt)**.
   Ista je kao regija funkcija (`fra1` u `vercel.json`), pa su upiti brzi.
2. Napravi branch `dev` za lokalni rad (Branches → New branch). Glavni branch (`main`) ostaje za produkciju.
3. **Connect** → izaberi branch → kopiraj connection string (pooled, `...-pooler...`).

## 2. Lokalno pokretanje

Potreban je Node 24+.

```bash
npm install
cp .env.example .env        # pa upiši vrijednosti, vidi ispod
npm run db:migrate          # kreira tabele (ponovno pokretanje je sigurno)
npm run db:seed             # učita data/households.csv (ili example ako ga nema)
npm run links:export        # out/links.csv sa linkovima
npm run dev                 # http://localhost:5173
```

`.env`:

| Varijabla           | Opis                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`      | Neon connection string (dev branch lokalno, main u produkciji)                                      |
| `ADMIN_TOKEN`       | Dug nasumičan string, **min. 32 znaka**: `openssl rand -base64 36`                                  |
| `PUBLIC_BASE_URL`   | Adresa sajta bez `/` na kraju. Lokalno `http://localhost:5173`                                      |
| `RSVP_DEADLINE`     | Opcionalno: zamjenjuje rok iz `shared/event.ts`. ISO **sa zonom**, npr. `2027-05-15T23:59:59+02:00` |
| `RATE_LIMIT_SECRET` | Opcionalno: ključ za hashiranje IP adresa. Ako je prazan, izvodi se iz `DATABASE_URL`               |

> Tajne (`DATABASE_URL`, `ADMIN_TOKEN`) nikad ne smiju imati `VITE_` prefiks i nikad se ne importuju u `src/`.
> ESLint to blokira, a `npm run check:bundle` provjerava gotov build.

### `npm run dev` ili `vercel dev`

- `npm run dev` pokreće Vite i mali dev plugin koji servira funkcije iz `api/`. Ne treba Vercel nalog.
- `npm run vercel:dev` (`vercel dev --local`, port 3000) pokreće pravi Vercel runtime, rewrites i
  rutiranje, također bez logina i linkanja. Čita `.env`, ali ne `.env.local`.

Ako koristiš `vercel dev`, postavi `PUBLIC_BASE_URL=http://localhost:3000`.

## 3. Komande

| Komanda                               | Šta radi                                               |
| ------------------------------------- | ------------------------------------------------------ |
| `npm run dev`                         | Lokalni dev server sa API-jem                          |
| `npm run build`                       | Produkcijski build u `dist/` (traži `PUBLIC_BASE_URL`) |
| `npm run typecheck` / `lint` / `test` | Provjere (sve moraju proći)                            |
| `npm run check:bundle`                | Nakon builda: provjeri da u `dist/` nema nijedne tajne |
| `npm run db:migrate`                  | Primijeni nove migracije iz `db/migrations/`           |
| `npm run db:seed`                     | CSV → baza (vidi ispod)                                |
| `npm run links:export`                | `out/links.csv` sa linkovima i WhatsApp porukama       |

## 4. Lista gostiju (`data/households.csv`)

Pravi spisak je u `data/households.csv`. **Nije u gitu** (`.gitignore`). Primjer je u
[`data/households.example.csv`](data/households.example.csv). Jedan red je jedan gost.

| Kolona         | Obavezno | Vrijednosti                                                                  |
| -------------- | -------- | ---------------------------------------------------------------------------- |
| `household`    | da       | **Stalni ID domaćinstva**, npr. `H001`. Ne mijenjaj ga nakon slanja linkova. |
| `side`         | da       | `adi`, `zerina`, `zajednicki`                                                |
| `table_name`   | ne       | npr. `Sto 3` (može kasnije)                                                  |
| `guest_name`   | da       | Ime i prezime gosta                                                          |
| `role`         | da       | `muz`, `zena`, `partner`, `dijete`, `gost`                                   |
| `sort_order`   | ne       | Redoslijed u domaćinstvu (1, 2, 3…). Ako fali, ide redom iz fajla            |
| `display_name` | ne       | Ime koje gost vidi ("Zoka i Danijela"). Ako fali, koristi se `household`     |

- Svi redovi istog domaćinstva moraju imati isti `side`, `table_name` i `display_name`.
- Može `,` ili `;` kao separator (Excel na bosanskim postavkama koristi `;`). Fajl mora biti **UTF-8**.
  U Excelu: _Save As → CSV UTF-8_. U Google Sheets: _File → Download → CSV_.
- `Zajednički`, `Žena` i `Muž` su također OK: dijakritika i velika slova se normalizuju.

```bash
npm run db:seed -- --dry-run     # samo pokaže šta bi se promijenilo
npm run db:seed                  # upiše
npm run db:seed -- --file data/drugi.csv
```

Seed je **idempotentan**, pa ga pokreni ponovo poslije svake izmjene CSV-a:

- nova domaćinstva i gosti se dodaju, a imena, uloge, stolovi i `display_name` se ažuriraju;
- **kodovi (linkovi) i odgovori se nikad ne mijenjaju**. Ispravka tipfelera u imenu zadržava odgovor
  (gost se prepoznaje po imenu, pa po `sort_order`);
- ono što je u bazi, a nema ga u CSV-u, samo se prijavi. `--prune` to briše, ali ne dira domaćinstva koja
  su otvorila link ili odgovorila ni goste koji su odgovorili. Za njih treba i `--force`;
- greška u CSV-u (pogrešna uloga, duplo ime, različit sto u istom domaćinstvu…) prekida seed sa brojem reda
  i ništa se ne upisuje.

## 5. Deploy na Vercel

1. [vercel.com/new](https://vercel.com/new) → Import Git Repository → `adi-saljic/zerina-adi-pozivnica`.
   Framework se prepoznaje (Vite). Build command `npm run build`, output `dist`.
2. **Settings → Environment Variables** (Production; za Preview po želji sa dev branchom):
   - `DATABASE_URL`: Neon **main** branch
   - `ADMIN_TOKEN`: drugačiji od lokalnog
   - `PUBLIC_BASE_URL`: npr. `https://pozivnica.example.ba`. Ako ga ne postaviš, build koristi Vercelov
     produkcijski domen (`VERCEL_PROJECT_PRODUCTION_URL`)
   - `RSVP_DEADLINE`: opcionalno
3. **Settings → General → Node.js Version:** 24.x (uzima se i iz `engines`).
4. Nad produkcijskom bazom pokreni migracije i seed lokalno, privremeno sa produkcijskim `DATABASE_URL`:
   ```bash
   DATABASE_URL='postgresql://…main…' npm run db:migrate
   DATABASE_URL='postgresql://…main…' npm run db:seed
   ```
5. Svaki push na `main` automatski deployuje.
6. Provjeri headere: `curl -I https://domena/` mora vratiti `content-security-policy`,
   `referrer-policy: no-referrer`, `x-robots-tag: noindex, nofollow` i `x-frame-options: DENY`.

## 6. Vlastita domena

Vercel → Project → **Settings → Domains → Add**. Kod registrara domene dodaj DNS zapis koji Vercel
pokaže (`A 76.76.21.21` za root ili `CNAME cname.vercel-dns.com` za poddomenu). HTTPS se
podesi sam. Zatim postavi `PUBLIC_BASE_URL` na novu domenu i **redeployuj**, jer se og: tagovi
upisuju pri buildu.

## 7. Slanje linkova

```bash
PUBLIC_BASE_URL=https://pozivnica.example.ba npm run links:export
```

`out/links.csv` (nije u gitu) ima jedan red po domaćinstvu:

- `link`
- `whatsapp_message`: gotova poruka, tekst se mijenja u `src/i18n/bs.ts` → `whatsapp.invite`
- `whatsapp_url`: `wa.me` link koji otvori WhatsApp sa porukom, pa samo izabereš kontakt

Separator je `;` (Excel na bs postavkama). Za `,` dodaj `-- --sep=comma`.

Prije slanja pošalji jedan link sebi i provjeri preview (vidi 9).

## 8. Praćenje odgovora

- **`/admin`**: unesi `ADMIN_TOKEN` (opcija "zapamti na ovom uređaju"). Prikazuje:
  - ukupne brojke, po strani i po stolu
  - ko nije odgovorio i ko nije otvorio link, sa dugmetom "Kopiraj link"
  - djelimične odgovore i poruke gostiju
  - dugme **Preuzmi CSV (Excel)**
- API za curl:
  ```bash
  curl -H "Authorization: Bearer $ADMIN_TOKEN" https://domena/api/admin/summary
  curl -H "Authorization: Bearer $ADMIN_TOKEN" -o gosti.csv https://domena/api/admin/export.csv
  # export sa zarezom umjesto ;  →  .../api/admin/export.csv?sep=comma
  ```

Napomena: i vaše otvaranje linka gosta povećava `open_count`.

## 9. WhatsApp preview

og: tagovi su statični u `index.html`. Vrijednosti (naslov sa datumom, opis, apsolutni URL slike)
upisuje build iz `shared/event.ts`, `src/i18n/bs.ts` i `PUBLIC_BASE_URL`. Slika je
`public/preview.jpg`: 1200×630, ispod 300 KB (sad placeholder od ~26 KB).

Testiranje nakon deploya:

1. [opengraph.xyz](https://www.opengraph.xyz): upiši link i provjeri naslov, opis i sliku.
2. [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/): klikni **Scrape Again**.
   WhatsApp koristi isti format.
3. WhatsApp kešira preview. Za test nove verzije dodaj `?v=2` (pa `?v=3`…) na link. Kad mijenjaš sliku,
   podigni i `?v=` u `og:image` u `index.html`.

## 10. Sigurnost

- Kodovi su 10 znakova base58 iz `crypto.randomBytes` (bez modulo biasa), ~58 bita entropije. Nigdje nema
  javnih sekvencijalnih ID-eva.
- Nepoznat i neispravan kod daju isti generički 404. Nijedan javni endpoint ne lista domaćinstva.
- RSVP se validira na serveru: kod postoji, svi gosti pripadaju domaćinstvu, niko ne fali, nema duplikata,
  rok nije prošao (409). Upis ide u jednoj transakciji, a svaki save ide u `rsvp_log`.
- POST traži `Content-Type: application/json` i same-origin (`Origin` / `Sec-Fetch-Site`), sa
  ograničenom veličinom body-ja. Nema CORS headera.
- Admin traži `Authorization: Bearer`, upoređuje se u konstantnom vremenu, a bez tokena (ili sa prekratkim)
  admin je ugašen.
- Headeri (`vercel.json`): strogi CSP, `Referrer-Policy: no-referrer` (kod iz URL-a ne curi npr. Google
  Mapsu), `X-Frame-Options: DENY`, `X-Robots-Tag: noindex`. Uz to `<meta robots noindex>` i `robots.txt`.
  `robots.txt` pušta samo preview botove (facebookexternalhit, WhatsApp) da bi preview radio.
- CSV exporti štite od formula injekcije (`=`, `+`, `-`, `@` na početku ćelije).
- Klijent dobija generičke greške, a detalji idu u Vercel logove.

### Poznata ograničenja

- **Rate limit** (u Neonu, po IP adresi; GET 120 i POST 30 zahtjeva na 10 min, admin 60): fixed window,
  pa su moguća 2× limita na granici prozora. Mnogo gostiju može dijeliti IP (mobilni operater, WiFi na
  svadbi), zato su limiti velikodušni. Služi protiv pogađanja kodova i floodanja, nije zaštita od DDoS-a.
- Ako `db:seed --prune` obriše gosta tačno dok neko spašava odgovor, taj save može ostaviti domaćinstvo
  djelimično odgovoreno. Admin to prikaže pod "Djelimično odgovorili".
- Dev CSP (Vite) dozvoljava `'unsafe-inline'` zbog React fast refresha. Produkcija koristi strogi CSP iz
  `vercel.json`. Ako dizajn uvede Google Fonts ili slične servise, treba proširiti `style-src`/`font-src`.

## Dizajn

Logika je odvojena od izgleda, pa se dizajn mijenja bez diranja logike:

- `src/styles/tokens.css`: boje, fontovi, razmaci (CSS varijable)
- `src/components/*.module.css`, `src/admin/AdminPage.module.css`: stil komponenti
- `src/components/*.tsx`: presentational komponente, po jedna za svaki ekran (Loading, InvalidLink,
  Invitation, Saving, Saved, Closed, Error)
- `src/hooks/`: state machine i logika (ne treba dirati zbog dizajna)
- `src/i18n/bs.ts`: **svi tekstovi**
- `shared/event.ts`: datum, vrijeme, sala, adresa, link mape, rok
- `public/preview.jpg`: slika za WhatsApp preview

## Struktura

```
api/                 Vercel funkcije (invitation, rsvp, admin/summary, admin/export)
api/_lib/            server helperi (_ = nije funkcija): env, db, http, rate limit, auth, SQL
shared/              dijeli se FE/API: zod sheme, RSVP validacija, event config, CSV
src/                 React app (nestiliziran) + /admin
scripts/             migrate, seed, export-links, check-bundle
db/migrations/       SQL migracije
vite-plugins/        og: tagovi pri buildu, dev /api server
tests/               testovi API handlera
```

Relativni importi u `api/` i `shared/` moraju završavati na `.js`. Bez toga lokalno radi, ali na Vercelu
puca (`ERR_MODULE_NOT_FOUND`). `npm run typecheck` to hvata.
