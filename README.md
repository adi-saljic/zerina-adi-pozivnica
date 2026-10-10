# Pozivnica · Zerina & Adi

Online pozivnica sa potvrdom dolaska (RSVP). Svako domaćinstvo dobija svoj link,
npr. `https://domena/zoka-i-danijela-k7x2p9Qa3m`. Gost vidi pozdrav ("Dragi Zoka i Danijela,")
i članove svog domaćinstva, za svakog označi **Dolazi / Ne dolazi**, može ostaviti poruku i klikne
**Spasi**. Odgovor može mijenjati do roka. Vi pratite odgovore na `/admin`.

### Linkovi: kod je jedina autorizacija, slug je ukras

- Link je `/<slug>-<kod>`. **Kod** (zadnjih 10 znakova iza zadnjeg `-`, nasumičan base58) jedini
  identifikuje domaćinstvo. **Slug** (`zoka-i-danijela`) se pravi iz `display_name` (č/ć→c, š→s, ž→z,
  đ→dj) i služi samo da link bude čitljiv.
- Ako se `display_name` promijeni nakon slanja, kod ostaje isti, a slug se ažurira. Stari link i dalje radi
  i stranica prebaci adresu na novi URL (`history.replaceState`). **Poslani linkovi se nikad ne kvare.**
- Stari formati `/?g=KOD` i `/p/KOD` i dalje rade i vode na novi URL.

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
[`data/households.example.csv`](data/households.example.csv). Jedan red je jedan član domaćinstva.

| Kolona           | Obavezno | Vrijednosti                                                                          |
| ---------------- | -------- | ------------------------------------------------------------------------------------ |
| `household_key`  | da       | **Stalni interni ključ**, npr. `Mama i tata (Adi)`. Gost ga ne vidi. Ne mijenjaj ga. |
| `display_name`   | da       | Ime koje gost vidi, npr. `Mama i tata`. Dvije pozivnice smiju imati isto ime         |
| `salutation`     | da       | `Dragi` ili `Draga` (pozdrav "Dragi Zoka i Danijela,")                               |
| `side`           | da       | `zerina` ili `adi`                                                                   |
| `guest_name`     | da       | Ime člana kako se prikazuje                                                          |
| `role`           | da       | `muz`, `zena`, `partner`, `dijete`, `gost`                                           |
| `is_placeholder` | ne       | `true` ako ime još nije pravo (`Ljubo +1`, `Zokino dijete 1`). Default `false`       |
| `table_name`     | ne       | Sto **ovog gosta** (djeca mogu sjediti za dječijim stolom)                           |
| `sort_order`     | da       | Redoslijed u domaćinstvu (1, 2, 3…). **Identitet gosta**: nove dodaj na kraj         |
| `review`         | ne       | Vaše bilješke, seed ih ignoriše (kao i svaku drugu nepoznatu kolonu)                 |

- Svi redovi istog domaćinstva moraju imati isti `display_name`, `salutation` i `side`.
- **Placeholder članovi** se na stranici prikazuju kao "Pratnja" (partner) ili "Dijete" (inače "Gost"),
  nikad kao "Ljubo +1". Gost može upisati pravo ime ("Ime (nije obavezno)"). Ono se sprema posebno
  (`name_from_guest`) i nikad ne prepisuje `guest_name`. Admin i CSV export prikazuju upisano ime.
- Može `,` ili `;` kao separator (Excel na bosanskim postavkama koristi `;`). Fajl mora biti **UTF-8**.
  U Excelu: _Save As → CSV UTF-8_. U Google Sheets: _File → Download → CSV_.
- `Zajednički`, `Žena` i `Muž` su također OK: dijakritika i velika slova se normalizuju.

```bash
npm run db:seed -- --dry-run     # samo pokaže šta bi se promijenilo
npm run db:seed                  # upiše
npm run db:seed -- --file data/drugi.csv
```

Seed je **idempotentan**, pa ga pokreni ponovo poslije svake izmjene CSV-a:

- domaćinstva se prepoznaju po `household_key`, a gosti unutar domaćinstva po `sort_order`;
- nova domaćinstva i gosti se dodaju. Imena, uloge, stolovi, `is_placeholder`, `display_name`,
  `salutation` i slug se ažuriraju;
- **nikad ne dira** odgovore (`attending`), poruke, imena koja su gosti upisali, kodove ni vremena
  otvaranja i odgovora. Kad placeholder dobije pravo ime (npr. "Ljubo +1" → "Amra"), odgovor ostaje;
- ono što je u bazi, a nema ga u CSV-u, samo se prijavi kao upozorenje. `--prune` pokaže šta bi obrisao i
  traži potvrdu (upiši `da`). Domaćinstva koja su otvorila link ili odgovorila, i gosti koji su odgovorili,
  brišu se samo uz `--force`;
- greška u CSV-u (pogrešna uloga, dupli `sort_order`, različit `salutation` u istom domaćinstvu…) prekida
  seed sa brojem reda i ništa se ne upisuje.

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

Pravi dva fajla u `out/` (nije u gitu):

- **`out/links.csv`**, jedan red po domaćinstvu:
  - `side`, `display_name`, `members` (članovi, razdvojeni zarezom), `url`
  - `whatsapp_message`: gotova poruka sa pozdravom ("Dragi Zoka i Danijela, Zerina i Adi se
    vjenčavaju…"); tekst se mijenja u `src/i18n/bs.ts` → `whatsapp.invite`
  - `household_key` i `whatsapp_url` (`wa.me` link koji otvori WhatsApp sa porukom)
- **`out/links.txt`**: isti podaci kao blok po domaćinstvu, lako za ručno kopiranje na mobitelu.

Separator je `;` (Excel na bs postavkama). Za `,` dodaj `-- --sep=comma`.

Prije slanja pošalji jedan link sebi i provjeri preview (vidi 9).

## 8. Praćenje odgovora

- **`/admin`**: unesi `ADMIN_TOKEN` (opcija "zapamti na ovom uređaju"). Prikazuje:
  - ukupne brojke, po strani i po stolu (stol je po gostu: pozvano, dolazi, ne dolazi, bez odgovora)
  - ko nije odgovorio i ko nije otvorio link, sa njihovim URL-om i dugmetom "Kopiraj link"
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

Preview je isti za svako domaćinstvo. `vercel.json` za svaku putanju bez tačke (osim `/api/*`) servira
`index.html`, pa i `/<slug>-<kod>` linkovi imaju iste og: tagove, a statični fajlovi
(`/preview.jpg`, `/robots.txt`) ostaju fajlovi.

Testiranje nakon deploya:

0. `curl -s https://<preview-url>/zoka-i-danijela-XXXXXXXXXX | grep og:` mora ispisati og: tagove
   sa apsolutnim `https://` URL-om slike.
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
