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
- Sklep: front w tym repo pod `/sklep`, dane z Medusy przez Store API
  (`https://commerce.marinero.150197.pl`, admin `.../app`). Stary osobny front
  `sklep.marinero.150197.pl` jest już nieużywany — do wygaszenia/przekierowania.

## Routes

`/`, `/lodzie`, `/modele`, `/modele/[slug]`, `/marki/[slug]`, `/silniki`, `/aktualnosci`,
`/archiwum`, `/kontakt`, `/sklep`, `/sklep/kategoria/[handle]`, `/sklep/produkt/[handle]`,
`/sklep/koszyk`, `/sklep/zamowienie`, `/api/configurator/submit`.

Strony żyją pod `src/app/[locale]/...`. Polski serwowany bez prefiksu (`/modele`),
pozostałe języki z prefiksem (`/en/modele`). `src/middleware.ts`: `/pl/...` przekierowuje
na adres kanoniczny, a wybór języka zapamiętany w ciasteczku `marinero_locale` przenosi
zwykłe linki do właściwej wersji. Słownik UI: `src/lib/i18n.ts`
(PL, EN, DE, FR, RU, UK, IT, ES). Treści z Directusa nie są tłumaczone.
Strona `/konfigurator/[slug]` istnieje technicznie, ale **nie linkować do niej** — konfigurator
jest osadzony na stronie modelu (`#konfigurator`).

## Kluczowe pliki

- Strona modelu: `src/app/[locale]/modele/[slug]/page.tsx`
- Lista modeli (filtry `?brand=` i `?series=`): `src/app/[locale]/modele/page.tsx`
- Strona główna: `src/app/[locale]/page.tsx`
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
- Sklep: `src/lib/medusa.ts` (Store API), `src/components/shop/*` (koszyk, karta
  produktu, checkout), strony pod `src/app/(intl)/[locale]/sklep/...`

## Typografia

Kroje leżą w `public/fonts` (OFL) i są wpięte przez `@font-face` w `globals.css` —
build nie zależy od sieci, przeglądarka nie odpytuje Google. **Konieczny jest podzbiór
`latin-ext`**, inaczej znikają polskie znaki.

- Tekst: **Inter** (`--font-sans`), całość serwisu.
- Nagłówki sklepu: **Newsreader**, szeryfowy (`--font-serif`, token `shop.display`) —
  wzorem leferment.pl. Reszta serwisu (`/modele`, `/lodzie`) zostaje bezszeryfowa.
- Baza tekstu w sklepie to 17 px (`shop.page`) — pak-in.pl ma 18 px, 15 px wyglądało
  jak panel administracyjny. Ceny zawsze bezszeryfowe, żeby cyfry się nie rozjeżdżały.

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

## Konfiguratory

- 56 modeli ma konfigurator. Aquila 42 Coupe: dane ręczne z oficjalnego cennika
  (`CONFIGURATOR_DATA`, cena bazowa `885000 USD`). Pozostałe 55: przepisane ze stron
  modeli marinero.pl (wtyczka all-in-one-forms) do `src/lib/generated-configurators.ts`
  i `src/lib/generated-equipment.ts` — `getConfiguratorData` bierze najpierw dane ręczne.
- Przy XO i Nordkapp Airborne cena bazowa wynosi 0, bo cenę łodzi niesie wybór silnika —
  kalkulator nie pokazuje wtedy wiersza „Cena bazowa" (tak jest w źródle).
- VAT 23%, kurs domyślny wg waluty; liczy netto i brutto PLN.
- Waluta wg marki: Aquila = USD, pozostałe marki = EUR (`getCurrencyForBrand`
  w `src/lib/configurator-data.ts`, domyślne kursy w `DEFAULT_PLN_RATES`).
- Sekcja „Wyposażenie standardowe" domyślnie otwarta, z przyciskiem Zwiń/Rozwiń.
- Select „Ofertę przygotowuje" pod ostatnim polem formularza — docelowo tylko po
  zalogowaniu; steruje stopką kontaktową i podpisem w PDF oraz adresami bcc/reply-to
  maila. Osoby pobierane z kolekcji `team` w Directusie (fallback: `FALLBACK_CONTACTS`
  w `route.js`). Bez wyboru oferta wychodzi z kontaktem do całego zespołu.
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

79 opublikowanych modeli w Directusie. Marki: Aquila, Jeanneau, Nordkapp Boats, Sting Boats,
XO Boats. Vanquish jest ukryty (status `draft` marki i modeli) — przywrócenie to zmiana
statusu w panelu.
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

## Sklep

- Front sklepu jest częścią tego serwisu (wspólny nagłówek, stopka, i18n, design).
  Medusa jest tylko backendem — pobieramy z niej produkty, kategorie, koszyk i zamówienia.
- Język wizualny sklepu: `src/components/shop/theme.ts` (atrament `#0E1A2B`, piasek
  `#F4F1EC`, akcent `#2E64A8`, `rounded-sm`, przyciski UPPERCASE z `tracking`).
  Inspiracja od klienta: pantuniestal.com, leferment.pl, flextail.com, pak-in.pl —
  redakcyjnie, bez ramek i cieni,
  zdjęcia `object-contain` na białych panelach. Wszystkie strony sklepu mają ten sam
  zestaw: `ShopAnnouncement` → `ShopHeader` (jeden nagłówek) →
  `ShopPageHeader` → treść → `ShopTrust` / `ShopContactBand` → `Footer`
  (`src/components/shop/ShopChrome.tsx`).
- Na stronach sklepu nagłówek serwisu ma tylko jedno wyjście („Łodzie") — reszta
  nawigacji dotyczy sklepu.
- Strona główna sklepu (kolejność wzorowana na pak-in.pl i flextail.com, gdzie
  produkty stoją tuż pod kadrem): hero na pełny ekran z **hasłem na zdjęciu**
  (nie akapitem — leferment.pl ma w `h1` cztery słowa) → pasek trzech obietnic →
  **produkty** → działy → `ShopStory` → nowości → marki → liczby → `ShopStory` →
  zaufanie → kontakt. Wcześniej pierwszy produkt pojawiał się dopiero na trzecim
  ekranie. Bloki `ShopStory` (zdjęcie + tekst + jedno CTA) przeplatają listy. Działy pokazujemy mozaiką (pierwszy na kadrze z wody, reszta
  na bieli), a „Najczęściej kupowane" jako jeden duży produkt + szyna z resztą.
  Kadry z życia daje `src/lib/shop-lifestyle.ts` (`getShopLifestyle` z galerii
  modeli w Directusie, `pickLifestyle` wybiera stałe zdjęcie dla kategorii).
- **Sklep jest jasny.** Ciemny granat tylko na cienkim pasku na samej górze — żadnych
  ciemnych hero ani ciemnych sekcji (ta sama zasada co na reszcie strony).
- **Podkategorie**: `ShopSubnav` pod nagłówkiem listy — na stronie kategorii pokazuje
  pozycje działu (Elektronika → Echomap, GPSMAP, Striker, Mapy, Lowrance), a w katalogu
  z `?marka=` pozwala zawęzić markę do działu (`/sklep/kategoria/silniki?marki=Suzuki`).
  Bez tego wejście w „Elektronikę" wysypywało 37 pozycji wszystkich marek naraz.
- **Zajawki marek** na stronie sklepu (`src/lib/shop-brands.ts` + `BrandTeaser`) —
  wzorem garmin.com każda marka ma kadr, hasło i szynę produktów. Produkty bierzemy
  z **kategorii marki, nie z nazwy** — plotery nazywają się „GPSMAP 923xsv", więc
  szukanie słowa „garmin" w tytule gubiło całą markę. Teksty są po polsku, tak jak
  nazwy produktów z Medusy.
- Zdjęcia marek: `public/marki-lifestyle/` — **placeholdery do podmiany** (README w środku).
  Bez pliku `BrandTeaser` bierze kadr z galerii modeli.
- `ShopQuickLinks` pod kadrem: kuratorska lista `QUICK_LINK_HANDLES` w `shop-taxonomy.ts`.
  Sortowanie po liczbie produktów wypychało na górę „Pozostałe" i „Maintenance Kit".
- `ProductRail` — szyna przewijana w poziomie (10–12 pozycji zamiast czterech w siatce),
  te same kadry co siatka.
- Kategorie w Medusie są płaską listą 56 wpisów po imporcie z WooCommerce (bez rodziców,
  duplikaty nazw, puste gałęzie). Porządek — 6 działów z podkategoriami — trzyma
  `src/lib/shop-taxonomy.ts` (`buildShopMenu` odfiltrowuje puste pozycje). Zmiana
  struktury menu = edycja tego pliku, nie panelu Medusy.
- **Sklep ma JEDEN nagłówek** — `src/components/shop/ShopHeader.tsx` (+ klienckie
  `ShopHeaderNav.tsx`). Wygląda jak nagłówek strony głównej (sticky, biały, pełne
  logo, języki, „Zadzwoń"), tylko odnośniki są sklepowe. Osobny pasek `ShopNav`
  został usunięty — dwa paski zostawiały pustą przestrzeń i nachodziły na siebie.
  Zasady układu (nie psuć, to były realne błędy u klienta):
  - działy widać od `xl`, niżej siedzą w `MobileMenu` (`groups` + `links`);
  - wyszukiwarka to **ikona otwierająca nakładkę** (`ShopSearch.tsx`) — wklejone
    pole w pasku nachodziło na linki działów, a w osobnym wierszu wyglądało jak
    doklejone (wzorzec: pantuniestal, leferment, flextail, pak-in);
  - dłuższe nazwy działów mają w `shop-taxonomy.ts` pole `short` na pasek
    („Oleje i chemia" → „Oleje"); pełna nazwa zostaje w rozwijanym menu;
  - kafelek działu nie ma `shrink-0`; przycinamy sam odnośnik (`overflow-hidden`
    + `truncate`), bo rozwijane menu jest jego rodzeństwem i musi zostać widoczne;
  - logo ma `min-w-0` (ustępuje koszykowi i menu na wąskim ekranie), a przełącznik
    języka poniżej `xl` jest w szufladzie menu — inaczej logo ściska się do paska.
- Produkty z WooCommerce to osobne wpisy, nie warianty (silnik czarny i biały, ploter
  9″ i 12″). `src/lib/product-family.ts` czyta z tytułów rodzinę i cechy (długość
  kolumny, sterowanie, kolor, przekątna ekranu), a `FamilyPicker` pokazuje je na
  stronie produktu jako wybór wersji — linki do siostrzanych produktów. Parsery:
  Suzuki DF, Mercury FourStroke, Torqeedo, GPSMAP, ECHOMAP. Rodzeństwa szukamy
  w najwęższej kategorii produktu (limit 100 wyników).
- Warianty w Medusie (np. Torqeedo „Akumulator: Tak/Nie") pokazuje `AddToCart` jako
  kafelki z nazwą opcji, nie bezimienny select.
- Zdjęcia produktów to pakshoty na białym tle — panele pod nimi (hero, galeria,
  miniatury w koszyku) muszą być białe, nie piaskowe.
- Ceny: sprzedaż jest brutto dla klientów prywatnych. To, czy Medusa traktuje ceny jako
  brutto, mówi `is_calculated_price_tax_inclusive` — front czyta tę flagę i podpisuje
  cenę („Cena zawiera VAT 23%" albo „Cena netto — VAT doliczamy w koszyku"), więc nigdy
  nie kłamie. Przełącznik jest po stronie Medusy: Ustawienia → Regiony → Polska →
  ceny zawierają podatek. W zamówieniu jest wybór kraju dostawy i pole NIP/VAT UE
  (trafia do `metadata` zamówienia); faktura bez VAT dla firm z UE wymaga jeszcze
  konfiguracji podatków w Medusie.
- Uwaga na Tailwind: nie nadpisywać koloru tekstu w `btnLight` (klasy nie mają
  pierwszeństwa wg kolejności) — od jasnego, wypełnionego przycisku jest `btnOnDark`.
- Strona produktu: `ProductGallery` (duży kadr + miniatury + zoom) i opis **pod**
  zdjęciami, po prawej sticky kolumna zakupu. Cena mieszka w `AddToCart`, bo idzie
  za wybranym wariantem.
- Koszyk i zamówienie mają nagłówek `ShopCheckoutHeader` z krokami 01–03.
- Kwoty z Medusy są w złotych (jednostka główna Medusy 2) — `formatPrice` nic nie dzieli.
  Po imporcie z WooCommerce siedziały tam grosze; ceny zostały przeliczone przez Admin API
  (kopia sprzed migracji poza repo), a o tym, że ceny są brutto, decyduje
  **price preference** dla waluty `pln` (`is_tax_inclusive: true`) — nie ustawienie regionu.
- Region sprzedaży: Polska (PLN). Dostawa: „Odbiór osobisty / wysyłka ustalana
  indywidualnie". Płatność: `pp_system_default` (ręczna — przelew/ustalenie po zamówieniu).
  Karty/BLIK wymagałyby skonfigurowania dostawcy płatności w Medusie.
- Kolejność wywołań przy składaniu zamówienia (nie zmieniać bez testu na żywym API):
  aktualizacja koszyka (email + adresy) → `shipping-methods` → `payment-collections`
  + `payment-sessions` → `carts/{id}/complete`.
- Termin wysyłki i dostawy liczy `src/lib/delivery.ts` (wzorzec: x-kom.pl — konkretna
  data przekonuje bardziej niż „2–3 dni"). Strefa `Europe/Warsaw`, granica wysyłek
  `CUTOFF_HOUR = 14`, pomijane weekendy **i polskie święta** (stałe + Wielkanoc liczona
  algorytmem Meeusa, Poniedziałek Wielkanocny i Boże Ciało). Data odświeża się z ISR
  co 5 minut. Kod dostępności `na-zamowienie`/`niedostepny` nie dostaje terminu.
- Dostępność produktu ustawia sprzedawca w panelu Medusy, w metadanych produktu:
  `dostepnosc` (`od-reki` | `2-3-dni` | `7-10-dni` | `14-dni` | `na-zamowienie` |
  `niedostepny`) i `sztuki` (liczba). Bez wpisu front zgaduje po marce
  (`src/lib/availability.ts`): Suzuki 2–3 dni, elektronika 7–10 dni.
- Sprzedaż bez VAT dla firm z UE: przycisk „Sprawdź" w zamówieniu woła
  `/api/vat/validate` (rejestr VIES). Po potwierdzeniu koszyk przechodzi do regionu
  „Unia Europejska (VAT UE)" (`automatic_taxes: false`) i dostaje promocję `VATUE`
  (−18,699187%, czyli równowartość VAT). Wynik: kwota netto, VAT 0, rabat widoczny
  w podsumowaniu. Faktury wystawiane są ręcznie.
- Dostawa: „Odbiór osobisty" 0 zł i „Kurier — dostawa pod adres" 20 zł (tak jak na
  starym sklepie); dla zagranicy „Wysyłka zagraniczna — koszt ustalamy indywidualnie".
- Filtry katalogu (lewa szyna na `/sklep/produkty` i stronach kategorii):
  `src/lib/shop-filters.ts` + `ShopFilters`. Wszystko na linkach z parametrami
  (`marki`, `dostepnosc`, `cena_od`, `cena_do`), więc działa bez JS i każdy stan
  filtrów ma własny adres. Filtrujemy na pełnej liście — kategoria i katalog
  dociągają wyniki stronami po 100.
- Nagłówki kategorii i katalogu (`ShopPageHeader`) dostają kadr z życia obok
  tytułu — dzięki temu listy produktów nie odstają od bloków redakcyjnych.
- **Jeden układ dla wszystkich list** (wzorzec: store.ferrari.com trzyma proporcje
  kadru w jednym tokenie `--product-media-aspect-ratio: 408 / 523` i siatkę
  `repeat(4, 1fr)`): tokeny `shop.grid`, `shop.gridNarrow`, `shop.tile`
  i `shop.section` w `theme.ts`, nagłówki sekcji przez `ShopSection`. Produkty,
  działy i wersje modelu mają ten sam kadr `aspect-[408/523]`.
  Nazwa produktu ma stałą wysokość dwóch linii, a rząd cech `min-h-[1.75rem]` —
  bez tego ceny w sąsiednich kafelkach stoją na różnych wysokościach.
  **Gęstość**: na telefonie DWIE kolumny (przy jednej na ekran wchodził jeden
  produkt), kadr `aspect-square`, siatka 2/3/4/5. Quick-add pokazuje się od `md`,
  bo na kafelku 167 px zjadał pół zdjęcia. Na listach filtry schodzą pod produkty
  (`order`), inaczej pierwszy kafelek był dopiero po całej szynie filtrów.
- Strona produktu: na telefonie kolejność to zdjęcia → zakup → opis, a przyklejony
  `StickyBuyBar` obserwuje `#zakup` (sam przycisk, nie całą kolumnę — ta na
  telefonie ciągnie się przez kilka ekranów). Przy jednym wariancie dodaje do
  koszyka, przy kilku odsyła do wyboru wersji.
- Treść zajawek marek edytuje się **w Medusie**: Kategorie produktów → kategoria →
  Metadata, klucze `zajawka_nadlinia`, `zajawka_tytul`, `zajawka_opis`,
  `zajawka_zdjecie`. Wartości domyślne siedzą w `src/lib/shop-brands.ts`.
- Lowrance i Fusion nie są podkategoriami Garmina — `ShopSubnav` zawęża chipsy
  do sekcji, w której siedzi aktywna kategoria. Dział „Elektronika" ma w Medusie
  uchwyt `garmin`, bo kategorie są płaskie; docelowa naprawa to kategoria nadrzędna
  w panelu Medusy.
- Kanały sprzedaży: reguły cen w `src/lib/channel-pricing.ts` (procent/kwota,
  nadpisania per kategoria), klient Allegro w `src/lib/allegro.ts`,
  `/api/kanaly/eksport?kanal=allegro` (CSV) i `POST /api/kanaly/sync`.
  Bez zmiennych `ALLEGRO_CLIENT_ID`, `ALLEGRO_CLIENT_SECRET`,
  `ALLEGRO_REFRESH_TOKEN` synchronizacja działa w trybie podglądu i niczego nie
  wysyła. Oferty łączymy z produktami po SKU (`external.id` w Allegro).
  Endpoint chroni `CHANNEL_SYNC_TOKEN` (nagłówek `x-sync-token`).
- Pole `fields` w Store API: nazwa bez plusa (`metadata`) przełącza Medusę w tryb
  „tylko te pola" i gubi `handle`/`title`/`description`. Zawsze `+metadata`,
  `+variants.sku`.
- Koszyk trzyma id w `localStorage` (`marinero_cart_id`); gdy koszyk wygaśnie w Medusie,
  klient czyści wpis i zaczyna nowy.
- Instalacja ma jeszcze kategorie z danych przykładowych Medusy (shirts, pants…) —
  są odfiltrowane w `getShopCategories`, tak jak kategorie bez produktów.
- Uwaga przy testach lokalnych: w sandboxie `fetch` w Node nie przechodzi przez proxy
  do hosta Medusy — serwer trzeba uruchamiać z `NODE_USE_ENV_PROXY=1`. Na VPS to zbędne.
