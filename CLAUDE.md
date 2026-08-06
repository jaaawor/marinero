# Marinero — frontend

Strona dealera łodzi (Next.js), wdrażana na VPS pod `https://marinero.150197.pl`.
Repo jest jedynym źródłem prawdy — VPS ściąga `main` i buduje automatycznie
(`/root/marinero-deploy.sh`, cron co 5 min). Nie edytować plików bezpośrednio na serwerze.

## Stack i infrastruktura

- Next.js 16.2.10, React 19, Tailwind 4 (przez `@tailwindcss/postcss`).
- Katalog na VPS: `/opt/marinero-frontend`, service `marinero-frontend.service`, port `127.0.0.1:3000`.
- CMS: Directus 12.1.1 (Docker w `/opt/marinero`, Postgres 16) — `https://dms.marinero.150197.pl/admin`.
  Kolekcje m.in.: `brands`, `product_lines`, `boat_categories`, `boat_models`, `boat_model_images`,
  `engine_brands`, `engine_models`, `pages`, `news`, `site_settings`, `quote_requests`.
- Sklep: Medusa (`https://sklep.marinero.150197.pl`, admin `https://commerce.marinero.150197.pl/app`) —
  działa osobno, **nie ruszać**.

## Routes

`/`, `/lodzie`, `/modele`, `/modele/[slug]`, `/marki/[slug]`, `/silniki`, `/aktualnosci`,
`/archiwum`, `/kontakt`, `/api/configurator/submit`.

Strony żyją pod `src/app/[locale]/...`. Polski serwowany bez prefiksu (`/modele`),
pozostałe języki z prefiksem (`/en/modele`). `src/middleware.ts`: `/pl/...` przekierowuje
na adres kanoniczny, a wybór języka zapamiętany w ciasteczku `marinero_locale` przenosi
zwykłe linki do właściwej wersji. Słownik UI: `src/lib/i18n.ts`
(PL, EN, DE, FR, RU, UK, IT, ES). Treści z Directusa nie są tłumaczone.
Strona `/konfigurator/[slug]` istnieje technicznie, ale **nie linkować do niej** — konfigurator
jest osadzony na stronie modelu (`#konfigurator`).

## Kluczowe pliki

- Strona modelu: `src/app/modele/[slug]/page.tsx`
- Lista modeli (filtry `?brand=` i `?series=`): `src/app/modele/page.tsx`
- Strona główna: `src/app/page.tsx`
- Galeria/lightbox: `src/components/LightboxGallery.tsx`
- Konfigurator: `src/components/BoatConfigurator.tsx`
- Dane konfiguratora (Aquila 42): `src/lib/configurator-data.ts`
- Wyposażenie standardowe: `src/lib/standard-equipment-data.ts`
- Dane oficjalne modeli: `src/lib/official-model-data.ts`
- Marki/serie/galerie: `src/lib/model-taxonomy.ts`
- Wygenerowane galerie: `src/lib/generated-gallery-data.ts`
- Dane publiczne z Directus: `src/lib/public-site-data.ts`
- Tłumaczenia interfejsu: `src/lib/i18n.ts`, przełącznik: `src/components/LanguageSwitcher.tsx`
- Wyszukiwarka w nagłówku: `src/components/ModelSearch.tsx`
- Karta aktualności: `src/components/NewsCard.tsx`
- API konfiguratora/PDF: `src/app/api/configurator/submit/route.js`

## Design — zasady

Wzorzec: MennYacht, szczególnie `https://mennyacht.gazdagroup.pl/modele/ferretti-yachts-infynito-80`.
Styl: premium, jasny, spokojny, dużo przestrzeni, białe karty na tle `#f6f5f2`, mało tekstu.

- Kolor akcentu: `#2E64A8`, hover `#28588F`. Bez złota, bez ciężkich ciemnych sekcji.
- **Nie** tworzyć nowego brandingu/logo (żadnej literki „M" w kółku) — prawdziwe logo:
  `public/logo-marinero.png`.
- Strona modelu (układ 1:1 jak wzorzec MennYacht): hero — duże zdjęcie po lewej, po prawej
  nazwa, opis, kafelki Marka / Seria (klikalne: `/modele?brand=X`, `/modele?brand=X&series=Y`)
  i przyciski CTA; pasek kafelków szybkich danych (Marka, Seria, Długość, Szerokość,
  Kabiny/Osoby, Cena bazowa netto); JEDNA galeria „Galeria" (zwinięte 3 kafelki +
  nakładka „+N zdjęć", lightbox) — bez podziału na zewnętrzną/wnętrze; zapis liczb
  z KROPKĄ dziesiętną (np. „9.38 m"); opis + tabela specyfikacji obok siebie
  (+ „Poproś o specyfikację");
  konfigurator; „Inne modele w ofercie" (karty `ModelCard`); sekcja CTA kontaktowa.
  Karty modeli (`src/components/ModelCard.tsx`): zdjęcie, marka, nazwa, seria,
  mini-specyfikacja Długość/Szerokość/Kabiny. Bez „Typ" i „Status VAT".
- Bez pustych kafelków i sierocych nagłówków typu „Galeria", „Opis", „Źródło danych".

## Konfigurator (Aquila 42 Coupe)

- Cena bazowa `885000 USD`, VAT 23%, domyślny kurs `3.75`; liczy netto USD i brutto PLN.
- Waluta wg marki: Aquila = USD, pozostałe marki = EUR (`getCurrencyForBrand`
  w `src/lib/configurator-data.ts`, domyślne kursy w `DEFAULT_PLN_RATES`).
- Sekcja „Wyposażenie standardowe" domyślnie otwarta, z przyciskiem Zwiń/Rozwiń.
- Dyskretny select „Ofertę przygotowuje" (Zespół/Michał/Marek) pod przyciskiem wysyłki —
  docelowo tylko po zalogowaniu; steruje stopką kontaktową i podpisem w PDF oraz
  adresami bcc/reply-to maila (dane osób: `OFFER_CONTACTS` w `route.js`).
- Wysyłka: `/api/configurator/submit` → generuje PDF (PDFKit), zapisuje rekord w Directus
  `quote_requests` z plikiem w polu `pdf_file`. PDF **nie może być publiczny** (żadnej
  publicznej ścieżki do plików PDF).
- PDF oferty (wzorzec: oferta Merry Fisher 895 S2): str. 1 logo + adres + tytuł + 2 zdjęcia
  modelu, str. 2 wyposażenie dodatkowe + uwagi + podpis, str. 3+ wyposażenie standardowe.
  **PDF bez cen** — ceny są tylko w kalkulatorze na stronie i w rekordzie Directus.
- Bez SMTP API zwraca `email_skipped_no_smtp` — to poprawny stan (zapis + PDF działają).
  Wysyłka maili wymaga env na VPS: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
  `MAIL_FROM`, `MAIL_TO` (nodemailer gotowy w `route.js`).
- PDFKit: naprawiony błąd `Helvetica.afm` przez `autoFirstPage: false`, `font: <ścieżka
  DejaVu>` w opcjach konstruktora i rejestrację fontów DejaVu przed `doc.addPage()` —
  **nie psuć tego w `route.js`**.

## Dane

Strona główna: kafelki marek (zdjęcie największego modelu marki), „Wybrane modele"
sterowane polem `featured` (kolejność `sort`) w kolekcji `boat_models` — bez zaznaczeń
pokazuje największy model każdej marki. Sekcja „Aktualności" czyta kolekcję `news`
(16 wpisów przeniesionych z marinero.pl). Osoby przygotowujące oferty: kolekcja `team`
(pole `status` = `published`), edytowalne w panelu admina.

Ok. 26 modeli w Directusie. Marki: Aquila, Jeanneau, Nordkapp Boats, Sting Boats, XO Boats.
Serie: Aquila (Molokai/Sport/Coupe/Yacht/Sail), Jeanneau (Cap Camarat, Merry Fisher,
Merry Fisher Sport), Nordkapp (Avant, Coupe, Enduro, Noblesse), Sting (S, DC),
XO (DFNDR, DSCVR, EXPLR). Silniki: Mercury (F 5–150, Verado 250/300),
Suzuki (DF 6A–300AP).

## Twarde zakazy (lekcje z przeszłości)

1. Żadnego czyszczenia DOM w przeglądarce à la `ModelPageCleanup` (usunięty) — potrafił
   skasować początek strony.
2. Żadnych backupów w katalogu projektu (`*.backup-*` w `src/` psuły build) — historia
   jest w gicie; backupy VPS tylko w `/opt/backups/...`.
3. Nie nadpisywać działającego headera/logo.
4. Nie commitować sekretów, tokenów ani `.env`.
5. Katalog `storage/` (PDF-y ofert) jest runtime'owy — w `.gitignore`, nie commitować.

## Deploy i weryfikacja (na VPS)

Cron uruchamia `/root/marinero-deploy.sh` (fetch `main` → build jako user `marinero` →
restart service). Ręczne wymuszenie: `bash /root/marinero-deploy.sh --force`.
Smoke-testy: `curl` na `/`, `/modele`, `/modele/aquila-42-coupe` (oczekiwane HTTP 200)
i `journalctl -u marinero-frontend --since "2 minutes ago"`.
