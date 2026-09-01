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

`/`, `/lodzie`, `/modele/[slug]`, `/marki/[slug]`, `/gielda`, `/gielda/[slug]`,
`/przyczepy`, `/przyczepy/[slug]`, `/silniki`, `/aktualnosci`,
`/archiwum`, `/kontakt`, `/sklep`, `/sklep/kategoria/[handle]`, `/sklep/produkt/[handle]`,
`/sklep/koszyk`, `/sklep/zamowienie`, `/regulamin`, `/polityka-prywatnosci`,
`/api/configurator/submit`.

Strony żyją pod `src/app/[locale]/...`. Polski serwowany bez prefiksu (`/lodzie`),
pozostałe języki z prefiksem (`/en/lodzie`). `src/middleware.ts`: `/pl/...` przekierowuje
na adres kanoniczny, a wybór języka zapamiętany w ciasteczku `marinero_locale` przenosi
zwykłe linki do właściwej wersji. Słownik UI: `src/lib/i18n.ts`
(PL, EN, DE, FR, RU, UK, IT, ES). Treści z Directusa nie są tłumaczone.
Strona `/konfigurator/[slug]` istnieje technicznie, ale **nie linkować do niej** — konfigurator
jest osadzony na stronie modelu (`#konfigurator`).

## Kluczowe pliki

- Strona modelu: `src/app/[locale]/modele/[slug]/page.tsx`
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
- Wyszukiwarka modeli z filtrami (marka/seria) + siatka wyników:
  `src/components/ModelFinder.tsx` — stoi na `/lodzie`, pod kafelkami marek.
  **Osobnej listy `/modele` już nie ma**: dwie bliźniacze strony to dwa miejsca
  do poprawiania i podział wyników w wyszukiwarce. `/modele` przekierowuje
  (301) na `/lodzie#modele` w `next.config.ts`. Strony pojedynczych modeli
  (`/modele/[slug]`) zostają — `basePath` w `ModelSearch` buduje właśnie je.
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
  wzorem leferment.pl. Reszta serwisu (`/lodzie`, strony modeli) zostaje bezszeryfowa.
- Baza tekstu w sklepie to 17 px (`shop.page`) — pak-in.pl ma 18 px, 15 px wyglądało
  jak panel administracyjny. Ceny zawsze bezszeryfowe, żeby cyfry się nie rozjeżdżały.

## Design — zasady

Wzorzec: MennYacht, szczególnie `https://mennyacht.gazdagroup.pl/modele/ferretti-yachts-infynito-80`.
Styl: premium, jasny, spokojny, dużo przestrzeni, białe karty na tle `#f6f5f2`, mało tekstu.

- Kolor akcentu: `#2E64A8`, hover `#28588F`. Bez złota, bez ciężkich ciemnych sekcji.
- **Nie** tworzyć nowego brandingu/logo (żadnej literki „M" w kółku) — prawdziwe logo:
  `public/logo-marinero.png`.
- Strona modelu (układ 1:1 jak wzorzec MennYacht): hero — duże zdjęcie po lewej, po prawej
  nazwa, opis, kafelki Marka / Seria (klikalne: `/lodzie?brand=X`, `/lodzie?brand=X&series=Y`)
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

- 56 modeli ma konfigurator. **Dane żyją w Directusie** (kolekcje `configurators`,
  `configurator_groups`, `configurator_options`) i tam się je edytuje.
  `src/lib/configurator-source.ts` czyta je z odświeżaniem co 5 minut; pliki
  `generated-configurators.ts` i `configurator-data.ts` zostają jako **zapas**
  na wypadek, gdyby Directus nie odpowiedział — konfigurator wtedy nie znika.
  Przy zmianie danych w panelu strona pokazuje je po najbliższym odświeżeniu ISR.
- Przy XO i Nordkapp Airborne cena bazowa wynosi 0, bo cenę łodzi niesie wybór silnika —
  kalkulator nie pokazuje wtedy wiersza „Cena bazowa" (tak jest w źródle).
- VAT 23%, kurs domyślny wg waluty; liczy netto i brutto PLN.
- Waluta wg marki: Aquila = USD, pozostałe marki = EUR (`getCurrencyForBrand`
  w `src/lib/configurator-data.ts`, domyślne kursy w `DEFAULT_PLN_RATES`).
- Sekcja „Wyposażenie standardowe" domyślnie otwarta, z przyciskiem Zwiń/Rozwiń.
- **Wyposażenie standardowe żyje w Directusie** (`equipment_groups` + `equipment_items`,
  edytowalne z poziomu modelu, pole „Wyposażenie"). Wcześniej siedziało wyłącznie
  w repozytorium, więc klient nie miał jak poprawić literówki w setkach pozycji.
  `src/lib/standard-equipment-source.ts` czyta Directusa (odświeżanie co 5 minut),
  a pliki `standard-equipment-data.ts` i `generated-equipment.ts` zostają jako
  **zapas** — tak samo jak przy konfiguratorach.
- Sekcję „Co zawiera cena bazowa" włącza się **osobno przy każdej łodzi**
  (`configurators.show_base_includes`). Przy 55 z 56 konfiguratorów opis mówił
  tylko „wyposażenie standardowe modelu wymienione poniżej", czyli powtarzał
  sekcję stojącą tuż pod nim — dlatego domyślnie jest wyłączona i włączona
  wyłącznie przy Aquilach. Gdy nie ma ani opisu, ani wyposażenia standardowego,
  **cała sekcja znika** (bez tego zostawał sam pasek marginesu z kreską).
- Opcje konfiguratora mogą mieć **kolor** (`configurator_options.color`),
  **zdjęcie** (`configurator_options.image`, plik w Directusie) i **opis**
  (`configurator_options.description` — „do czego to jest", np. przy uchwycie
  narciarza czy lodówce). Front pokazuje próbkę/miniaturkę albo ikonę „i"
  przy nazwie, a `src/components/OptionPreview.tsx` rozwija dymek.
- Dymek jest renderowany **portalem do `<body>`**, nie obok przycisku. Lista
  opcji ma `overflow-hidden` (od zaokrąglonych rogów), więc dymek pozycjonowany
  absolutnie wewnątrz niej był przycinany — zostawała sama ramka, a treść
  znikała pod kolejnym wierszem. Pozycję liczymy z `getBoundingClientRect()`;
  przewinięcie strony zamyka dymek, bo inaczej zostałby w powietrzu.
- Dymek otwiera się na najechanie **oraz** na kliknięcie i fokus klawiatury.
  Samo najechanie nie wystarcza: na telefonie najechania nie ma. Kafelek stoi
  wewnątrz `<label>` opcji, więc klik ma zatrzymaną propagację — bez tego
  obejrzenie koloru zaznaczałoby opcję i doliczało ją do oferty.
- `configurator_groups.layout` = `kafelki` pokazuje grupę jako **siatkę
  kafelków ze zdjęciem** (do próbek tapicerki), zamiast listy.
  Kadr jest **poziomy** (`aspect-[16/9]`), trzy kafelki w rzędzie — łodzie są
  szersze niż wysokie i kwadrat obcinał im dziób albo rufę.
  Do **renderów całej łodzi** (kolor kadłuba) jest osobny `kafelki-szer`:
  `aspect-[21/9]`, `object-contain` na czerni, dwa w rzędzie. Rendery XO mają
  927 × 406 px, czyli są dwa razy szersze niż wysokie — w kadrze 16/9
  `object-cover` ucinał im dziób i rufę, każdemu wariantowi inaczej.
  Kafelek **bez zdjęcia** pokazuje próbkę koloru z podpisem „próbka koloru":
  producent nie dosyła renderu do każdego wariantu (XO Grey nie ma go
  w żadnym skoroszycie), a sam kolorowy prostokąt obok dwóch zdjęć łodzi
  wyglądał jak dziura w rzędzie.
  Cena stoi **pod** nazwą, nie obok: nazwy kolorów bywają całym zdaniem
  („XO Classic (Kadłub oklejony czarną folią karbonową…)") i przy cenie
  z boku spadały do wąskiej kolumny na osiem wierszy. Nazwa ma `line-clamp-3`
  i stałą wysokość, żeby kafelki stały równo.
- **Kolor silnika zależy od wybranego silnika.** Grupa z ustawionym
  `configurator_groups.engine_brand` (`mercury`, `suzuki`) pokazuje się dopiero
  po wybraniu silnika tej marki, a jej dopłata mnoży się przez liczbę silników —
  przy „2x Mercury…" kolor kosztuje dwa razy tyle. **Sama kwota to pokazuje**;
  dopisku „(2 ×)" przy cenie ani „× 2" przy nazwie w ofercie już nie piszemy,
  bo czytały się jak druga pozycja.
- **Warianty silnikowe idą bez miniaturek.** Producent ma zdjęcia do garstki
  wariantów (u XO 5–6 z kilkunastu), więc lista wychodziła dziurawa: przy
  jednym silniku kadr, przy trzech następnych nic. Kolor silnika to co innego —
  tam zdjęcie jest całą treścią wyboru. `scripts/xo/zdjecia.py` pomija grupy
  silnikowe, żeby kolejny przebieg ich nie wracał.
  Kadr jest **pionowy** (`layout` = `kafelki-pion`, `object-contain` na bieli):
  silnik zaburtowy jest wyższy niż szerszy i w poziomym kadrze zostawała z niego
  sama pokrywa. Dopłaty za biały: Mercury przy Nordkappie 600 EUR (cennik
  producenta), przy XO 1100 EUR **za silnik** (pozycja `3EP08` w formularzu
  zamówienia), przy Jeanneau 600 EUR; Suzuki 227 EUR netto, czyli 1200 zł
  brutto przy domyślnym kursie 4,30 i VAT 23%.
- **Zdjęcia kolorów Mercury są jedne dla całego serwisu** — pakshoty
  z Nordkappa, dobrane rodzinami: Verado V6/V8/V10 (`nk_verado-v8`), Verado
  V12 (`nk_verado-v12`) i czterocylindrowy FourStroke (`nk_fourstroke-r4`),
  każdy w wersji czarnej i białej. Idą i do XO (grupa „Kolor silnika
  Mercury"), i do Aquili, gdzie koloru się nie wybiera, ale wariant silnikowy
  nazywa go wprost („2 × **czarne** Mercury Verado V10 400 KM") i miniaturka
  w liście od razu pokazuje, o czym mowa.
- **Zdjęcia kolorów Suzuki wzięliśmy z własnego sklepu** — Medusa trzyma każdy
  silnik osobno w wersji czarnej i białej, a pakshoty leżą jeszcze na
  `sklep.marinero.pl`. Wspólna para dla całego serwisu to DF 350 ATX
  (`suzuki-df350-czarny`, `suzuki-df350-bialy`): ten sam kadr i ta sama
  generacja obudowy w obu kolorach. Zdjęcia producenta mają **różnej wielkości
  margines bieli** (biały DF 350 to 1490 × 993 px z silnikiem w lewej jednej
  trzeciej), więc przed wgraniem przycinamy je do samego silnika i sadzamy na
  kwadratowym białym płótnie 900 × 900 — inaczej w kafelku `object-contain`
  jeden silnik byłby dwa razy mniejszy od drugiego. Przy przycinaniu próg
  liczy się **na kolumnę i wiersz**, nie na pojedynczy piksel: znak wodny przy
  stopie rozciągał kadr z 490 na 966 px.
- **Uwaga przy pobieraniu ze starego sklepu**: `sklep.marinero.pl` na część
  adresów oddaje **stronę HTML** („trwają prace"), która waży 12 kB i przechodzi
  przez próg wielkości pliku — do Directusa trafiał wtedy dokument HTML
  podpisany jako `image/jpeg`, Directus nie umiał go przeskalować i na stronie
  zostawała ikona zepsutego obrazka. Sprawdzamy **nagłówek pliku**, nie rozmiar.
- Pod tytułem w kadrze otwierającym stoi **zajawka**, nie cały opis: jedno–dwa
  zdania ucięte na granicy zdania plus odnośnik „Pełny opis i dane techniczne"
  do sekcji `#opis`. Powtarzanie całego opisu przy zdjęciu robiło z hero ścianę
  tekstu.
- **Pakiet wyposażenia liczy się raz.** Wybór pakietu zaznacza pozycje, które
  ten pakiet niesie, i pokazuje przy nich „w pakiecie" zamiast dopłaty — do sumy
  nie wchodzą, bo w pakiecie są taniej niż z osobna. Ręczne odznaczenie
  którejkolwiek z nich **zdejmuje pakiet**: kalkulacja wraca do stanu bez
  pakietu, a pozostałe pozycje liczą się normalnie. Wiązanie idzie po kodach
  katalogowych (`configurator_options.includes`), nie po nazwach, a ta sama
  pozycja bywa w kilku pakietach naraz — liczy się ten, który jest wybrany.
  Grupa pakietów ma **zawsze** pozycję „Tylko wyposażenie standardowe";
  bez niej z grupy radio nie dało się wyjść.
- Przy łodziach z ceną bazową 0 (Airborne, XO, Aquila) zaznaczony jest
  **najtańszy wariant silnikowy** — bez tego kalkulator otwierał się z „Razem
  netto 0", co wygląda na awarię.
- **Konfiguratory Nordkappa idą wprost od producenta.** Strona modelu na
  nordkapp-boats.com trzyma cały cennik w `<script id="model_boat">`: opcje
  z ceną, opisem, zdjęciem i kodem katalogowego SKU, pakiety wyposażenia,
  tapicerki i warianty silnikowe. `scripts/nordkapp/pobierz.py` ściąga to dla
  17 modeli, `scripts/nordkapp/import.py` przepisuje do Directusa
  (tłumaczenia: `nazwy.json`, `opisy.json`). Skrypt **nie rusza cen bazowych
  ani grup silnikowych** — producent podaje cenę łodzi razem z silnikiem,
  a u nas baza jest bez silnika i doliczamy do niej także Suzuki i silniki
  elektryczne; przeliczenie jednego na drugie to decyzja handlowa.
  Nasze pozycje spoza cennika (Garmin, mapy) zostają z `off_price_list`,
  a o tym, co jest czyje, decyduje tabela `stare-opcje.json` — dopasowanie
  po nazwach jest bezużyteczne, bo „Lodówka szufladowa" to u producenta
  „Szuflada chłodząca 30 l". Zdjęcie i opis pozycji bierzemy z **dowolnego**
  modelu, przy którym producent je podał; przy pojedynczej łodzi połowa pól
  jest pusta. Skrypt najpierw **wstawia** nowe opcje, a dopiero potem kasuje
  stare, i ponawia urwane żądania: przy odwrotnej kolejności jedno zerwane
  połączenie TLS w środku przebiegu skasowało bezpowrotnie nasze pozycje
  przy Airborne 6.3 (odtworzone z `directus_revisions`). Nadmiar da się
  usunąć, braku nie da się odtworzyć.
- **Konfiguratory Aquili idą z cenników producenta** (`scripts/aquila/`,
  README w środku). Osobny skoroszyt na model, ceny w USD, sekcje oddzielone
  pustym wierszem. **Cena bazowa zostaje 0**, a wariant silnikowy niesie całą
  cenę łodzi — tak działały konfiguratory Aquili od początku. Trzy pułapki
  tego arkusza: nazwa sekcji nie zawsze stoi w jej pierwszym wierszu (przy
  42 Yacht silnik standardowy leży nad etykietą „Engine"), sekcja silnikowa
  bywa nazwana „Power" (28 Molokai Cuddy), a napięcie instalacji nie ma opisu
  — wariant siedzi w kolumnie ceny. Nazwy przenosimy z poprzedniego wydania
  konfiguratorów, parując po cenie w obrębie jednej łodzi.
  Sekcji **„Voltage" nie importujemy w ogóle**: napięcie instalacji pokładowej
  wynika z rynku, na który idzie łódź, a nie z życzenia klienta — w formularzu
  zostawiało wybór między 110 V a 120 V, czyli między dwoma tym samym.
  **Transport wchodzi zaznaczony**, bo łódź trzeba przywieźć z Szanghaju,
  a cennik zostawia w tym miejscu „do potwierdzenia z dealerem". Stawka idzie
  z długości kadłuba (`TRANSPORT` w `import.py`): do 28 stóp 18 000 USD,
  do 36 — 50 000, do 47 — 90 000, powyżej — 120 000. Oferta bez tej pozycji
  byłaby o kilkadziesiąt tysięcy dolarów za tania.
  **Grupy są wspólne dla całej marki, nie brane z cennika**: producent kroi go
  za każdym razem inaczej (osprzęt pokładowy to raz „Deck Gear", raz „Deck
  Equipment", raz „Deck Gear and Anchoring"; agregat stoi osobno od elektryki),
  co dawało 44 sekcje na jedenaście łodzi. `nazwy.json` sprowadza je do 27
  naszych grup, a `KOLEJNOSC` w `import.py` ustawia je zawsze tak samo — od
  silnika po transport. Pakiety nawigacyjne zostają osobną grupą **radio**,
  bo w jednej grupie z resztą elektroniki dało się odhaczyć Silver i Platinum
  naraz. Nasze pozycje spoza cennika (`off_price_list`) import zostawia
  nietknięte, tak samo jak przy XO.
- **Konfiguratory Stinga idą z rocznego cennika** (`scripts/sting/`, README
  w środku). Jeden skoroszyt na sezon: arkusz z cenami łodzi w wariantach
  silnikowych i po jednym arkuszu opcji na model. Do listopada 2026 żadna łódź
  Stinga nie miała u nas konfiguratora — cała marka stała na samych zdjęciach.
  **Cena bazowa zostaje 0**, tak jak przy XO: cennik podaje cenę łodzi razem
  z silnikiem. Ceny „STD" (pozycja w standardzie) i „-" (niedostępna na tym
  modelu) pomijamy — to nie są opcje do doliczenia. Tłumaczenia w `nazwy.json`.
  Sting 470 Pro i 725 Pro T-Top zostają bez konfiguratora, bo nie ma ich
  w cenniku MY25. **Wyposażenia standardowego cennik nie zawiera** — odsyła na
  stronę producenta, a ta trzyma je w znaczniku `<script id="model_boat">`,
  tak samo jak Nordkapp (obie marki należą do Frydenbø). Czyta je
  `scripts/sting/wyposazenie.py`; lista producenta jest krótka, 9–16 pozycji
  na model. **Opisy modeli** siedzą w `scripts/sting/opisy.json` i wchodzą do
  `short_description` (stamtąd strona bierze zajawkę i sekcję „Opis").
  Dziesięć z trzynastu łodzi nie miało opisu w ogóle, a przy 485 S stało
  wklejone wyposażenie standardowe — ten sam błąd co przy Avancie 705.
- **Konfiguratory XO idą z formularzy zamówień producenta** (`scripts/xo/`,
  README w środku). XO wysyła na sezon jeden skoroszyt na model, z arkuszami
  „Order form", „Boat Standard", „Layout" i „Upholstery"; `czytaj.ts` czyta go
  tym samym kodem co `/admin/cenniki`, `import.py` przepisuje konfigurator,
  a `wyposazenie.py` — wyposażenie standardowe. Tłumaczenia leżą w plikach
  (`nazwy-*.json`, `wyposazenie.json`), bo dopasowanie po nazwach jest
  przegrane: nasze pozycje są po polsku, cennik po angielsku.
  **Cena bazowa konfiguratorów XO zostaje 0** — cenę łodzi niesie wybór
  silnika, a cena kadłuba bez silnika wchodzi jako pozycja „Bez silnika".
  Przy DFNDR 8 baza wynosiła 72 000 € obok wariantów silnikowych po 109 000 €,
  czyli kadłub liczył się dwa razy. Nasze pozycje spoza cennika (Suzuki, COX)
  siedzą w `nasze.json` z ceną i bazą z dnia, w którym je ustalono — import
  dolicza im różnicę bieżącej bazy, bo przy podwyżce kadłuba silnik kosztuje
  tyle co wcześniej. Zdjęcia próbek tapicerki wyjmujemy ze skoroszytu po
  **rozmiarze pliku**: kotwica obrazka bywa przesunięta o wiersz, a ten sam
  plik jest w każdym skoroszycie co do bajta. Arkusz „Layout" to nie rzuty,
  tylko **rendery łodzi w kolorach oklejenia** — idą pod opcje grupy „Kolor
  kadłuba i pokładu", która przechodzi wtedy na kafelki.
- **Zdjęcia opcji XO idą ze strony producenta**, bo w formularzu zamówienia nie
  ma ani jednego kadru. `scripts/xo/zdjecia.py` czyta katalog spod
  `xoboats.com/configurator` (produkty WooCommerce z nazwą, ceną i zdjęciem)
  i podpina zdjęcia po tabeli `zdjecia.json` — nazwy na stronie są krótsze
  i starsze niż w cenniku, więc dopasowanie po podobieństwie tekstu jest
  bezużyteczne. Import cennika **przenosi zdjęcie** na nowy wpis po nazwie
  opcji; bez tego każdy kolejny cennik kasowałby cały dorobek zdjęciowy.
- Select „Ofertę przygotowuje" pod ostatnim polem formularza — docelowo tylko po
  zalogowaniu; steruje stopką kontaktową i podpisem w PDF oraz adresami bcc/reply-to
  maila. Osoby pobierane z kolekcji `team` w Directusie (fallback: `FALLBACK_CONTACTS`
  w `route.js`). Bez wyboru oferta wychodzi z kontaktem do całego zespołu.
- Wysyłka: `/api/configurator/submit` → generuje PDF (PDFKit), zapisuje rekord w Directus
  `quote_requests` z plikiem w polu `pdf_file`. PDF **nie może być publiczny** (żadnej
  publicznej ścieżki do plików PDF).
- **Zapis oferty idzie tokenem** (`DIRECTUS_ADMIN_TOKEN`), tak samo jak formularz
  kontaktowy. Bez nagłówka Directus odbijał każde zapytanie („You don't have
  permission to access collection quote_requests") i przez to **żadna oferta nie
  trafiała do panelu** — kolekcja stała pusta. Publicznego zapisu tu nie chcemy,
  bo kolekcja stałaby otworem dla botów.
- PDF-y ofert lądują w folderze **„Oferty"** w bibliotece plików (szukanym po
  nazwie, więc jego identyfikator nie siedzi w kodzie), a nazwa pliku to
  `oferta-<model>-<klient>-<data>.pdf` — sam znacznik czasu nic nie mówił.
- Kolekcja `quote_requests` jest opisana po polsku i podzielona na zakładki
  (Oferta / Klient / Kalkulacja / Dane techniczne), a lista pokazuje **datę,
  model, klienta, e-mail, kto przygotował, kwotę netto, stan i PDF**, sortowana
  od najnowszej. `prepared_by` i `prepared_by_email` zapisujemy z wyboru
  „Ofertę przygotowuje".
- PDF oferty (wzorzec: oferta Merry Fisher 895 S2): str. 1 logo + adres + tytuł + 2 zdjęcia
  modelu, str. 2 wyposażenie dodatkowe z cenami + kalkulacja + uwagi + podpis,
  str. 3+ wyposażenie standardowe. **Lista wyposażenia idzie bez kwot, a cena
  jest jedna — „Kalkulacja" tuż pod listą, przed uwagami i podpisem**: „Razem
  netto" i „Razem brutto PLN" z kursem i stawką VAT. Dopłata przy każdej
  pozycji zamieniała ofertę w cennik. Przy cenie bazowej 0 (XO, Sting,
  Airborne) wiersz „Cena bazowa" w ogóle nie wchodzi.
  Wyposażenie standardowe w PDF bierzemy **z formularza** (czyli z Directusa),
  a plik w repozytorium jest zapasem — inaczej oferta wypisywała inną listę
  niż strona modelu.
- **Kopia oferty dla zespołu idzie osobnym listem**, nie w BCC przy liście do
  klienta. BCC do skrzynki, z której list wychodzi, bywa po cichu pomijane
  przez serwer pocztowy — wysyłka kończyła się powodzeniem (`email_status:
  sent`), a kopia nie docierała. List do zespołu ma **własną treść**: model,
  klient, telefon, kwota netto i brutto oraz uwagi, bo powiadomienie „Dzień
  dobry, w załączeniu przesyłamy ofertę" nie mówiło handlowcowi, do kogo
  oddzwonić. Obie wysyłki idą **niezależnie**, żeby odbicie jednego adresu nie
  gubiło drugiego; `email_status` rozróżnia, która się nie udała.
  Kopia idzie **osobnym listem na każdy adres**, a nie jednym do wszystkich:
  `sendMail` kończy się powodzeniem także wtedy, gdy serwer przyjął przesyłkę
  i po cichu odrzucił jednego odbiorcę, więc przy jednym liście do trzech osób
  nie było jak zobaczyć, że do jednej nie poszedł. Odrzucone adresy
  (`info.rejected`) dopisujemy do `email_status`, żeby było je widać w panelu.
  Do sprawdzenia samych adresów jest `scripts/poczta/kopia-oferty.mjs`
  (nie zakłada wpisu w „Zapytaniach ofertowych") — wysyła po jednym liście
  na adres i wypisuje, który serwer przyjął, a który odrzucił.
- Bez SMTP API zwraca `email_skipped_no_smtp` — to poprawny stan (zapis + PDF działają).
  Wysyłka maili wymaga env na VPS: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
  `MAIL_FROM`, `MAIL_TO` (nodemailer gotowy w `route.js`).
- PDFKit: naprawiony błąd `Helvetica.afm` przez `autoFirstPage: false`, `font: <ścieżka
  DejaVu>` w opcjach konstruktora i rejestrację fontów DejaVu przed `doc.addPage()` —
  **nie psuć tego w `route.js`**.

## Dane

Regulamin i polityka prywatności to wpisy w kolekcji `pages` (slug = adres,
`status` = `published`) — klient poprawia treść w panelu, bez wdrożenia.
Oba napisane pod ten sklep (dostawa, płatność przelewem, VAT UE, 14 dni
odstąpienia, niezgodność towaru z umową), z danymi spółki: KRS 0000838631,
NIP 5862355376, REGON 385942933. Wspólny komponent:
`src/components/LegalPage.tsx`, style `.legal-content` w `globals.css`.

W `site_settings` doszły pola redagowane w panelu: `shop_warranty` (tekst przy
gwarancji na stronie produktu — słownik `shopWarrantyValue` zostaje jako
zapasowy), `whatsapp_boats` i `whatsapp_shop` (numery pod pływający przycisk),
`facebook_url` (widżet w stopce) i `map_query` (co wpisać w mapę; puste = `address`).

Stopka: najpierw widżet Facebooka i mapa Google (zwykłe `<iframe>`, bez SDK
i bez dodatkowych skryptów), pod nimi kontakty do ludzi z kolekcji `team`
(jak na marinero.pl) — bez nazwisk, samo imię i rola. Wtyczka Facebooka renderuje się w stałej szerokości z adresu, więc
ramka ma `max-w-[320px]`, `small_header` i `hide_cover` — inaczej sama okładka
zjadała wysokość, a na telefonie zostawała pusta kolumna.
**Oba `<iframe>` mają `sandbox` bez `allow-top-navigation`.** Wtyczka Facebooka
linkuje z `target="_top"`, więc kliknięcie w nią przenosiło **całą kartę** na
facebook.com. Stopka stoi pod każdą stroną, a przy krótkich — logowanie,
zakładanie konta — widżet ląduje tuż pod przyciskiem, więc wystarczyło chybić
palcem, żeby zamiast konta zobaczyć Facebooka. Z piaskownicą kliknięcie otwiera
nową kartę (`allow-popups`), a nasza zostaje na miejscu. W stopce piszemy
**Marinero**, nie „Marinero sp. z o.o." (pełna nazwa jest w regulaminie);
`site_settings.address` trzyma sam adres.

Pole `offers` w kolekcji `team` decyduje, kto pojawia się w konfiguratorze
(„Ofertę przygotowuje") — stopka pokazuje wszystkich, także sklep i serwis.
Pole `department` (`sprzedaz` / `sklep` / `serwis`) dzieli baner kontaktowy
na kolumny; przy dziale „Serwis" nie pokazujemy telefonu, bo zgłoszenia
przyjmuje mail, a telefon odbierają Monika i Sonia.

Baner z Facebookiem, mapą i kontaktami to wspólny `src/components/ContactBand.tsx` —
stoi w stopce (`bare`) i na stronie kontaktu. Strona kontaktu podaje stopce
`hideContactBand`, żeby baner nie stał dwa razy pod rząd.

Formularz na `/kontakt` (`ContactForm` + `POST /api/kontakt`) obsługuje pytanie
i zapis na serwis okresowy. Zgłoszenie **zawsze** ląduje w kolekcji
`contact_requests`, a mail jest dodatkiem — odwrotna kolejność gubiłaby
zgłoszenia przy każdej awarii SMTP. Serwisowe idą na `serwis@marinero.pl`,
reszta do biura. Ukryte pole `website` to pułapka na boty.
Adres firmy: **biuro@marinero.pl** (nie `info@`), biuro serwisu w Marina Yacht
Park przy bosmanacie.

Pływający przycisk WhatsApp (`WhatsAppButton`) siedzi w stopce, a numer wybiera
po ścieżce: `/sklep...` → sklep, reszta → łodzie. Kliknięcie otwiera okno
rozmowy: status („jesteśmy online" w godzinach z `site_settings.whatsapp_hours`,
liczonych w strefie `Europe/Warsaw` po stronie przeglądarki), pole na pytanie
i przejście do WhatsAppa z gotową treścią.
Ma `z-40` (pod nagłówkiem i nakładkami) i odsuwa się od dołu o `--sticky-bar-h`,
którą ustawia `StickyBuyBar`, żeby nie zasłaniać paska zakupu.

Strona główna: kafelki marek (zdjęcie największego modelu marki), „Wybrane modele"
sterowane polem `featured` (kolejność `sort`) w kolekcji `boat_models` — bez zaznaczeń
pokazuje największy model każdej marki. Sekcja „Aktualności" czyta kolekcję `news`
(16 wpisów przeniesionych z marinero.pl). Osoby przygotowujące oferty: kolekcja `team`
(pole `status` = `published`), edytowalne w panelu admina.

79 opublikowanych modeli w Directusie. Marki: Aquila, Jeanneau, Nordkapp Boats, Sting Boats,
XO Boats. Vanquish jest ukryty (status `draft` marki i modeli) — przywrócenie to zmiana
statusu w panelu.
Serie: Aquila (Molokai/Sport/Coupe/Yacht/Sail), Jeanneau (Cap Camarat, Merry Fisher,
Merry Fisher Sport), Nordkapp (Airborne, Avant, Coupe, Enduro, Noblesse),
Sting (Console Boat, Utility Boat), XO (DFNDR, DSCVR, EXPLR).
Silniki: Mercury (F 5–150, Verado 250/300), Suzuki (DF 2.5–350).

Nazwy modeli Nordkappa i Stinga **zgadzają się co do jednej** z listami na
`nordkapp-boats.com/boats/` i `sting-boats.no/en/boats/` (17 i 13 pozycji).
Dopisek „R" w starych adresach marinero.pl (`nordkapp-avant-605-r`) to
nieużywana już nazwa linii R — nie wraca do katalogu.

## Giełda i przyczepy

- `/gielda` to **konkretne egzemplarze**, nie katalog typów — kolekcja
  `used_boats` w Directusie. Pole `condition` dzieli je na cztery stany
  (`od-reki`, `w-produkcji`, `demo`, `uzywana`) i w tej kolejności stoją
  na stronie: najpierw to, co klient może mieć najszybciej. `sold` zdejmuje
  łódź z listy, ale zostawia ją w bazie.
- Karta giełdy (`src/components/OfferCard.tsx`) celowo różni się od `ModelCard`:
  tam liczy się typ łodzi, tu rocznik, motogodziny i cena. Puste pole ceny to
  **„Cena na zapytanie"**, nigdy „0 zł".
- **Waluta musi iść z rekordu** (`formatOfferPrice`) — giełda ma oferty w EUR
  i w PLN naraz, a wpisane na sztywno „zł" pokazywało 159 800 zł przy cenie
  159 800 EUR, czyli czterokrotnie zaniżało kwotę.
- 28 łodzi i 20 przyczep przeniesionych z marinero.pl razem ze zdjęciami
  (zdjęcia wgrane do Directusa, nie linkowane ze starej strony — ta zostanie
  wyłączona). Pole `used_boats.price` miało skalę 5 miejsc po przecinku,
  czyli limit 99 999 — poprawione na `decimal(12,2)`.
- `/przyczepy` — kolekcja `trailers`. Przy każdej podajemy dopuszczalną masę
  i maksymalną długość łodzi, bo przyczepę dobiera się do jednostki, nie na oko.
- `used_boats.boat_model` wiąże egzemplarz z modelem z katalogu. Strona modelu
  pokazuje wtedy sekcję „Dostępne u nas" **między konfiguratorem a „Inne modele
  w ofercie"** — kto ogląda Nordkappa 830, chce najpierw wiedzieć, czy mamy go
  na stanie. Bez wolnych sztuk sekcja w ogóle się nie renderuje.
- `used_boats.sold` („Ukryta / sprzedana") zdejmuje ofertę ze strony, ale
  **zostawia ją w bazie** ze zdjęciami i opisem — odznaczenie przywraca.
  To jest właściwy sposób na chwilowe schowanie łodzi, nie kasowanie.
- Etykiety stanu na kartach mają **pełny kolor**, nie 10% krycia: przezroczyste
  tło zlewało się ze zdjęciem i etykieta była praktycznie niewidoczna.
- Oferty bez własnych zdjęć dostają `PhotoPlaceholder` (powtórzone logo
  + „Zdjęcia wkrótce") — pusty szary prostokąt wygląda jak błąd.
- Zdjęcia ze starej strony: `og:image` na marinero.pl to **logo serwisu**,
  identyczne na każdej podstronie — branie go jako zdjęcia oferty daje 48 kopii
  logotypu. Prawdziwe fotografie siedzą w galerii, leniwie ładowanej: adres
  jest w `data-src`, bywa bezprotokołowy (`//marinero.pl/...`), a `src` zawiera
  przezroczysty gif. Warianty rozmiarowe WordPressa (`-1024x683`) trzeba obciąć,
  żeby wziąć oryginał. **Zdjęcia zbieramy per znacznik `<img>`, nie z całego
  HTML-a**: na dole strony wisi szyna „inne łodzie" (klasa `pt-cv-`), przez
  którą na ofertę Nordkappa trafiały kadry Aquili i XO. Zdjęcia bywają
  **PNG-ami** (Saxdor, Husky, Finnmaster) — filtr na `.jpg/.webp` zostawiał
  osiem łodzi bez zdjęcia, choć fotografie na starej stronie były.
- **Zdjęcia idą przez skalowanie Directusa**, nie w oryginale: `assetUrl`
  dokleja `?width=…&format=webp&quality=82` (karty 900 px, galerie 1600 px).
  Fotografie od producentów miały po kilkanaście megabajtów — `N830-1.jpg`
  ważył 23 MB i szedł na kafelek szerokości 400 px, przez co sama lista giełdy
  ciągnęła ponad 100 MB. Po zmianie `/gielda` to ~1,9 MB na 25 zdjęć.
  Directus **nie przeskaluje** pliku, którego nie umiał odczytać (brak wymiarów
  w metadanych) ani powyżej limitu wymiaru — zwraca wtedy 400 i zdjęcie znika,
  więc takie oryginały trzeba najpierw zmniejszyć (skrypt: max 2560 px, JPEG 82).
- Obie kolekcje mają publiczny odczyt (front pyta Directusa bez tokenu)
  i trafiają do `sitemap.ts`.
- Telefon w nagłówku: strona z łodziami bierze `site_settings.phone`, sklep
  `site_settings.phone_shop` — te numery odbierają inne osoby.

## SEO

- `src/lib/seo.ts` — adres kanoniczny, `hreflang` dla ośmiu języków i dane
  strukturalne. `src/app/sitemap.ts` buduje mapę z danych (modele, marki,
  aktualności, działy i produkty sklepu), `src/app/robots.ts` wskazuje na nią
  i zamyka `/api/`, `/konfigurator/`, koszyk i zamówienie.
- Każda strona modelu i marki ma własny tytuł i opis (`generateMetadata`).
  Wersje polskie w grupie `(pl)` **muszą przekazywać** `generateMetadata`
  z wersji `(intl)` — inaczej dostają wspólny tytuł z layoutu.
- Dane strukturalne: `AutoDealer` w layoutach, `Product` + `BreadcrumbList`
  na stronie modelu i produktu. **Ceny łodzi nie trafiają do `offers`** —
  na stronie są netto, w euro albo dolarach, a w wyniku wyszukiwania
  wyglądałyby na cenę końcową. Ceny sklepowe (brutto, PLN) już tak.
- Nazwy modeli bywają zapisane z marką („Aquila 42 Coupe"), a bywają bez —
  `fullModelName` nie dokleja marki drugi raz.

## Narzędzia wewnętrzne (`/narzedzia-8f3a`)

- **Wspólna rama panelu**: `src/components/admin/PanelShell.tsx` (nagłówek
  strony + ochrona logowaniem) i `PanelNav.tsx` (przyklejony pasek z zakładkami
  w grupach Sklep / Allegro / Łodzie, kto zalogowany, wylogowanie). Każde
  narzędzie powtarzało wcześniej ten sam nagłówek u siebie, a z zamówień do
  cenników trzeba było wracać przez spis.
  Powłoka **sama sprawdza logowanie** — niezalogowany widzi sam formularz, bez
  zakładek, bo klikanie po niedostępnych narzędziach prowadzi donikąd.
  `children` może być funkcją `(kto) => …`: cenniki i wyposażenie podpisują
  zapis nazwą zalogowanej osoby, a powłoka i tak o nią pyta Directusa.
- `/narzedzia-8f3a/cenniki` — wgranie cennika producenta (.xlsx albo .csv, po angielsku,
  w dowolnym układzie kolumn), dopasowanie do modeli, **podgląd z możliwością
  poprawy** i dopiero wtedy zapis do Directusa. Nic nie zapisuje się samo.
- Logowanie kontem z Directusa (`/auth/login`), token w ciasteczku `httpOnly`,
  zapis idzie **tokenem zalogowanej osoby** — w repozytorium nie ma żadnego
  tokenu administratora.
- `src/lib/xlsx-read.ts` czyta XLSX bez zewnętrznej biblioteki (ZIP + XML przez
  `node:zlib`) — build nie zależy od kolejnej zależności.
- Dwa tryby (`PriceTools`): **cennik marki** (ceny bazowe wielu łodzi naraz)
  i **cennik jednej łodzi** (dopłaty za opcje konfiguratora + cena bazowa).
- **Cennik jednej łodzi = formularz zamówienia od producenta.** `src/lib/order-form.ts`
  czyta „order form" w dowolnym układzie: kolumny rozpoznaje po nagłówku
  (`Part code` / `Description` / `Unit price` w kilku językach), a gdy nagłówka
  nie ma — po zawartości. Wiersz z opisem **i** ceną to opcja, opis **bez** ceny
  to nagłówek sekcji, `(choose one)` robi z sekcji grupę `radio`, a wiersz
  „boat price / standard equipment" daje cenę bazową.
- **Kod katalogowy jest kluczem, nie nazwa.** Nasze opcje są po polsku, cennik po
  angielsku, więc dopasowanie po nazwach jest przegrane — na XO DFNDR 8 automat
  trafił 17 pozycji na 99, w tym błędnie. Dlatego `order-form-match.ts` paruje
  najpierw po polu `code` (pewne, zaznaczane domyślnie), a nazwy i ceny dają
  **wyłącznie podpowiedzi do potwierdzenia**. Blokada na liczbach jest ta sama
  co przy cennikach marek: „Verado 425V10" nie wskoczy na „Verado 350KM L6".
- Pozycje bez pary paruje się **ręcznie**, listą wyboru w wierszu (są w niej
  tylko opcje jeszcze niesparowane, więc jedna opcja nie dostanie dwóch cen).
  To celowo nie jest automat: zostawione na „dołóż jako nową" dokładają nową
  pozycję, a przy 91 naszych opcjach i 99 z cennika bezmyślne dołożenie
  zdublowałoby cały konfigurator.
- Trzecie wyjście w tej liście to **„pomiń"** — pozycja z cennika, której nie
  sprzedajemy (np. „US / CANADA VERSION"). Klucze pomijanych (kod, a bez kodu
  znormalizowana nazwa) siedzą w `configurators.price_list_skip`, więc tej
  samej decyzji nie podejmuje się co roku od nowa.
- **Nasze pozycje spoza cennika** (silniki Suzuki, COX, „bez silnika" przy XO)
  mają `configurator_options.off_price_list`. Import ich nie rusza, nie
  podpowiada przy parowaniu i nie wykazuje w „U nas jest, w cenniku nie ma" —
  bez tego przy każdym imporcie dopominałyby się o uwagę.
- `src/lib/marine-glossary.ts` daje **podpowiedź** polskiej nazwy dla pozycji
  z cennika (przycisk „Podpowiedz polskie nazwy"). To podmiana słownictwa
  łodziowego, nie tłumaczenie — nie odmienia przez przypadki, więc wynik zawsze
  ląduje w polu do edycji, nigdy prosto do bazy. Kolory podmieniamy **tylko
  małą literą**: „XO White" i „White Carbon 3M CA-419" to nazwy własne i po
  przetłumaczeniu przestawały być rozpoznawalne. Poprawienie samej nazwy
  zaznacza wiersz do zapisu, nawet gdy cena się nie zmieniła.
- Przy zapisie kod z cennika ląduje w `configurator_options.code` (grupy mają
  `code`, konfigurator `price_list_note` z nazwą i datą ostatniego pliku).
  Dzięki temu **pierwszy import każdej łodzi to jednorazowe parowanie, a każdy
  następny idzie sam** — dopasowanie po kodzie jest bezbłędne.
- `src/lib/pricelist.ts` (tryb cennika marki) szuka kolumn po zawartości, nie po nagłówku.
  Dopasowanie do modelu jest twarde na liczbach: „895" i „795" to różne łodzie,
  więc rozbieżność w liczbach zeruje trafienie. Marka liczy się tylko na plus,
  bo cennik Jeanneau nie powtarza słowa „Jeanneau" w każdym wierszu.
- `/narzedzia-8f3a/wyposazenie` — **wklejenie całej listy wyposażenia naraz**, zamiast
  dodawania pozycji po jednej w panelu (przy jednej łodzi bywa i trzysta
  wierszy). `src/lib/equipment-paste.ts` rozbija wklejony tekst na grupy
  i pozycje: przy wyposażeniu dodatkowym wiersz **z ceną** to opcja, a **bez
  ceny** nagłówek grupy (ta sama zasada co w `order-form.ts`); przy
  standardowym nagłówek poznajemy po dwukropku albo wersalikach. Cenę czytamy
  **tylko z końca wiersza** — inaczej „Głośniki 6,5\" 200 W" kosztowałyby 200.
  Punktory, numeracja, kropki wiodące i numery stron z PDF-a lecą do kosza.
  Zapis dopiero po podglądzie, z wyborem „dopisz" albo „zastąp".
- `/narzedzia-8f3a/zamowienia` — **zamówienia ze sklepu**, żeby codziennej
  obsługi nie robić w panelu Medusy po angielsku. Lista z płatnością (stan
  Medusy **i** PayU obok siebie), rozwijane szczegóły z pozycjami i adresem,
  a z boku: stan obsługi, numer przesyłki, uwagi wewnętrzne i ponowna wysyłka
  potwierdzenia.
  **Stan obsługi trzymamy w metadanych zamówienia** (`obsluga`), nie
  w `fulfillment_status` Medusy: Medusa liczy realizację przez osobne zasoby
  (fulfillments, shipments) zakładające magazyn i rezerwacje, których tu nie
  prowadzimy. Zapisanie numeru przesyłki ustawia stan „Wysłane" — osobne
  klikanie stanu tylko po to, żeby zgadzał się z rzeczywistością, to robota
  dla maszyny.
  Automat wysyła potwierdzenie **raz**; przycisk w panelu wymusza ponowną
  wysyłkę (`wymus`), bo klient bywa z literówką w adresie.
  Kształt pól sprawdza `scripts/medusa/zamowienie-podglad.mjs` — gdy kolumna
  w panelu świeci pustką, Medusa trzyma tę wartość gdzie indziej.
- `/narzedzia-8f3a/produkty` — **cena, dostępność, liczba sztuk i EAN w jednej
  tabeli**, wiele produktów naraz. Zmienione wiersze się podświetlają, przy cenie
  stoi „było…", a zapis idzie dopiero po kliknięciu — dotąd zmiana ceny znaczyła
  albo wejście do Medusy po jednym produkcie, albo przepuszczenie całego arkusza.
  **Cena w Medusie 2 należy do wariantu, nie do produktu.** Czytamy
  `variants.prices` (cenę zapisaną), nie `calculated_price` — to drugie jest
  wynikiem wyceny dla regionu i waluty i bez pełnego kontekstu Medusa odbija
  zapytanie („Method calculatePrices requires currency_code in the pricing
  context"). Zapis idzie przez **endpoint pojedynczego wariantu**
  (`POST /admin/products/{id}/variants/{wariant}`): aktualizacja produktu
  przyjmuje tablicę `variants` i potrafi potraktować ją jak komplet, czyli
  podanie jednego wariantu skasowałoby pozostałe. Prawie każdy nasz produkt ma
  jeden wariant, bo po migracji z WooCommerce silnik czarny i biały to dwa
  osobne produkty.
  Dostępność, sztuki i EAN to **metadane produktu**, nie stany magazynowe
  Medusy — sklep nie prowadzi magazynu, sprzedawca podaje termin wysyłki.
  Każda zmiana idzie do Medusy osobnym żądaniem i osobno zdaje raport: przy
  dwudziestu cenach jeden odrzucony produkt nie może przewrócić pozostałych
  ani zostawić nas bez wiedzy, który to był.
- `/narzedzia-8f3a/produkty/[id]` i `/produkty/nowy` — **pełna edycja i zakładanie
  produktu**: nazwa, opis, adres w sklepie, zdjęcia (wgrywanie do Medusy),
  kategoria, cena, dostępność, EAN i stan (szkic / opublikowany). Nazwa w tabeli
  prowadzi do edycji; tabela zostaje do szybkich poprawek ceny i dostępności.
  **Nowy produkt trzeba podpiąć do kanału sprzedaży**, inaczej nie pokaże się
  w sklepie: Store API filtruje po kanale i towar znika, choć w panelu Medusy
  wygląda poprawnie. Kanał i profil wysyłki pobieramy sami, żeby sprzedawca nie
  musiał znać żadnych identyfikatorów. Produkt powstaje jako **szkic**.
  **Zdjęcia i kategorie Medusa traktuje jak komplet** — wysyłamy pełną listę,
  bo podanie części skasowałoby resztę. To odwrotnie niż metadane, które się
  scalają; łatwo się na tym przejechać.
  Wgrywanie plików idzie na `/admin/uploads` polem **`files`** (inne nazwy
  wracają z 400). Pierwsze wgrane zdjęcie zostaje miniaturą.
  SKU jest **tylko przy zakładaniu** — po nim łączymy oferty z Allegro, więc
  zmiana po fakcie rozspójniłaby integrację.
- `/narzedzia-8f3a/ceny` — **cena i liczba sztuk, w sklepie i na Allegro obok
  siebie**, wszystko do edycji, plus eksport i import arkusza. Osobnej zakładki
  „Ceny na Allegro" (`/narzedzia-8f3a/kanaly`) **już nie ma**: pokazywała te same
  liczby, tylko bez możliwości poprawienia, a dwie tabele z tym samym to dwa
  miejsca do sprawdzania, kiedy coś się nie zgadza. Adres przekierowuje na
  `/narzedzia-8f3a/ceny`, moduł `allegro-ceny` zniknął z listy uprawnień.
  **Sztuki w sklepie to metadana produktu** (`sztuki`), nie magazyn Medusy —
  sklep go nie prowadzi. **Stan na Allegro** idzie przez `updateOffer`.
  Każda z czterech rzeczy (cena sklep, cena Allegro, sztuki, stan Allegro)
  zapisuje się **osobnym żądaniem i osobno zdaje raport**: przy dwustu pozycjach
  jedna odrzucona nie może przewrócić pozostałych.
  Pod tabelą stoi lista **„Na Allegro, ale nie u nas"** — oferty, których
  sygnatura jest pusta albo nie zgadza się z żadnym SKU ani EAN-em. Bez niej
  „nie ma na Allegro" przy produkcie znaczyło raz brak oferty, a raz literówkę
  w sygnaturze, i nie dało się tego odróżnić. Przy każdej takiej ofercie stoi
  **wybór produktu ze sklepu**: `updateOffer` wpisuje wtedy jego SKU
  w `external.id` oferty. Robimy to stąd, a nie ręcznie w panelu Allegro, bo
  przepisywanie SKU z ekranu na ekran kończy się literówką — a literówka
  w sygnaturze wygląda dokładnie tak samo jak brak oferty. Do wyboru idą tylko
  produkty **jeszcze niesparowane**: dwie oferty z tą samą sygnaturą dostałyby
  cenę z jednego wiersza.
  **Ofert na Allegro panel nie wystawia** i nie będzie: wystawienie wymaga
  kategorii, parametrów, zdjęć, sposobu dostawy i warunków zwrotu, czyli całego
  formularza Allegro. Kolejność przy nowym towarze jest więc taka: produkt
  w sklepie (SKU ustala się **przy zakładaniu**) → oferta w Allegro
  („Wystaw podobnie") → sygnatura, ręcznie albo z tej listy. Rozwijana
  instrukcja stoi pod tabelą, żeby nikt nie szukał jej w dokumentacji. Źródłem prawdy dla obu kolumn jest
  `src/lib/ceny-kanalow.ts` — pary robimy po SKU (sygnatura sprzedawcy
  w Allegro), więc oferta bez sygnatury nie ma się z czym sparować.
  **Wgrany arkusz wypełnia pola do zatwierdzenia, a nie zapisuje.** Ta sama
  droga zapisu co przy ręcznej edycji: jeden pasek na dole pokazuje, co się
  zmieni. Dwie osobne drogi zapisu to dwa miejsca, w których można się pomylić.
  Kolumny w arkuszu szukamy **po nagłówku, nie po pozycji** — sprzedawca może
  dostawić własną kolumnę z notatką. Liczby czytamy tolerancyjnie: Excel oddaje
  „1 790,50" z twardą spacją i przecinkiem.
  Sklep i Allegro zapisujemy **osobno**: odbicie jednej ceny nie zabiera
  drugiej, a przy podwyżce na dwustu pozycjach jedno odrzucone Allegro nie może
  zostawić sklepu w połowie przepisanego.
  Identyfikator oferty i EAN idą w arkuszu jako **tekst** — Excel zrobiłby
  z nich liczby i uciął zera wiodące albo przeszedł na notację wykładniczą.
  Kolumny arkusza: SKU, EAN, Nazwa, Kategoria, Publikacja, Cena sklep,
  Cena Allegro, Cena detaliczna, Przekreślona, Zmiana ceny, Stan sklep,
  Stan Allegro, Oferta Allegro. Import czyta też
  starą nazwę „Sztuki sklep" — sprzedawca może mieć u siebie arkusz sprzed
  zmiany nazwy. **Zero jest
  poprawną wartością stanu** („wyprzedane"), więc przy imporcie sprawdzamy
  pustkę pola, a nie jego prawdziwość — inaczej wyzerowania nie dałoby się
  wgrać. Kolumnę ceny sklepowej szukamy po „cena sklep", nie po samym „sklep":
  „Sztuki sklep" też zawiera to słowo.
  **Pary szukamy po SKU, a gdy nie ma — po EAN-ie.** Część ofert została
  wystawiona z EAN-em w polu sygnatury i przy samym SKU wypadała z zestawienia
  jako „nie ma na Allegro", choć jest. Wiersz mówi, po czym się sparował.
  Zestawienie jest **zapamiętane na minutę** (`zapomnijCeny()` kasuje je po
  zapisie): jedno wejście to cztery strony produktów i trzy strony ofert, czyli
  siedem żądań po sieci. Bez tego każde odświeżenie kazało czekać kilkanaście
  sekund i przy jednowątkowym Node blokowało resztę panelu. Dalsze strony
  produktów pobieramy **równolegle**, bo pierwsza mówi, ile ich jest.
  **Pobranie ma blokadę jednoczesności** (`wTrakcie` w `ceny-kanalow.ts`, ta sama
  co przy wymianie tokenu Allegro): pamięć zapisuje się dopiero na końcu, więc
  drugie wejście w zakładkę — odświeżenie albo druga karta — zaczynało **własny
  pełny przebieg**. Dwa takie przebiegi duszą się nawzajem na jednowątkowym
  Node i panel stawał na pasku „Pytam sklep o produkty… 2%", czasem na minuty.
  Kto dołącza do trwającego pobrania, dostaje **ostatni meldunek natychmiast**
  (`ostatniPostep`) — bez tego czekałby na następny etap i pasek stałby mu na
  zerze, czyli wyglądałoby to jak ta sama awaria.
- **Cena detaliczna to dwie różne rzeczy** i dlatego są dwa pola
  (`src/lib/cena-detaliczna.ts`, wolny od sieci — czyta go panel, kafelek,
  strona produktu i feed do Google): `cena_detaliczna` to sugerowana cena od
  dostawcy, sama z siebie **tylko do porównania w panelu**, a
  `cena_przekreslona` decyduje, czy pokazać ją klientowi jako przekreśloną
  cenę regularną. Przełącznik jest osobny, bo cena katalogowa jest prawie
  zawsze wyższa od naszej i bez niego **cały katalog wyglądałby na
  przeceniony** — a stała promocja przy każdej pozycji to nie promocja, tylko
  szum. Przekreślenia nie pokazujemy też wtedy, gdy cena detaliczna **nie jest
  wyższa** od bieżącej: przekreślona kwota niższa albo równa wygląda jak
  pomyłka, nie jak okazja.
  W feedzie do Google przy włączonym przekreśleniu idą **obie ceny**:
  `g:price` to kwota sprzed przeceny, `g:sale_price` bieżąca. Sama cena po
  przecenie przy przekreśleniu widocznym na stronie kończy się odrzuceniem
  oferty za niezgodność ceny ze stroną — a tego nie widać, dopóki ktoś nie
  wejdzie do Merchant Center.
- **Najniższa cena z 30 dni (Omnibus)** — `src/lib/historia-cen.ts`. Ogłaszając
  obniżkę, trzeba podać najniższą cenę z 30 dni **przed** nią, więc sama data
  ostatniej zmiany nie wystarcza: potrzebna jest historia. Siedzi
  w `historia_cen` w metadanych produktu jako lista `{ d: "2026-03-12", c: 8900 }`,
  dopisywana przy **każdej** zmianie ceny z panelu (tabela cen i edytor
  produktu), zawsze **po udanym zapisie**. Trzymamy 40 dni i najwyżej 60 wpisów —
  metadane jadą z produktem w każdej odpowiedzi Store API, a do liczenia trzeba
  tylko trzydziestu dni.
  Trzy rzeczy, które łatwo zrobić źle: **dzisiejsza cena nie wchodzi do okna**
  (inaczej „najniższa z 30 dni" równa się cenie właśnie obniżonej i komunikat nic
  nie mówi); przy dwóch zmianach tego samego dnia zostaje **niższa** kwota, bo
  pytanie brzmi o najniższą, nie o ostatnią; a przy braku historii zwracamy
  `null` i **nic nie piszemy** — zmyślona kwota w tym miejscu to wprowadzanie
  klienta w błąd. Test okna i granic: `scripts/` nie ma go na stałe, ale logika
  jest sprawdzona na jedenastu przypadkach (granica 30/31 dni, dwie zmiany
  jednego dnia, przycinanie, realna przecena).
  Linia pokazuje się tam, gdzie widać obniżkę: na stronie produktu i na kafelku,
  we wszystkich ośmiu językach (`shopLowest30`). Panel pokazuje przy przełączniku
  „przekreślona", co klient zobaczy — albo że historii jeszcze nie ma.
  **Przy 387 produktach po migracji z WooCommerce historia jest pusta** i zacznie
  się wypełniać od pierwszej zmiany ceny zrobionej w panelu.
- **Daty zmiany cen** (`cena_zmieniona`, `cena_detaliczna_zmieniona`) zapisujemy
  **po udanym zapisie**, nie przed: odrzucona cena zostawiałaby świeżą datę przy
  starej kwocie. Znacznik czasu bierzemy raz na całe zapytanie, bo dwieście
  pozycji wpisanych jednym kliknięciem to jedna zmiana, nie dwieście. Przy
  cenach przeniesionych z WooCommerce data zostaje **pusta** — nie wiemy, kiedy
  je ustawiono, a zmyślona data jest gorsza niż żadna.
- **Po zapisie z panelu odświeżamy tylko zmienione produkty**
  (`src/lib/odswiez.ts`), nigdy `revalidatePath("/sklep", "layout")`.
  Poddrzewo `/sklep` to 387 produktów razy osiem języków, czyli ponad trzy
  tysiące stron — jeden zapis ceny unieważniał je wszystkie, a każde następne
  wejście (także bota) regenerowało jedną z nich i pytało Medusę. Efekt:
  procesor pod sufitem, 5 GB pamięci i 504 na części żądań. Teraz idzie osiem
  adresów na zmieniony produkt plus dwie listy po polsku; listy w pozostałych
  językach dochodzą do siebie same przy najbliższym ISR.
- `src/lib/xlsx-write.ts` — **zapis XLSX bez biblioteki**, para dla
  `xlsx-read.ts`. Wpisy ZIP-a idą **bez kompresji** (metoda 0), więc nie
  potrzeba deflate'a, tylko własnego CRC-32.
  Dwie pułapki, obie już raz trafione: **nie zbierać bajtów w tablicy i nie
  rozwijać jej przez `push(...)`** — rozwinięcie przekazuje każdy bajt jako
  osobny argument i przy arkuszu z czterystoma produktami kończy się
  „Maximum call stack size exceeded"; piszemy do gotowego `Uint8Array` po
  bajcie. I **rozmiar katalogu centralnego liczyć przed pisaniem stopki**,
  bo `pozycja` przesuwa się z każdym zapisem. Nasz czytnik tego nie sprawdza
  i plik otwierał się u nas poprawnie, a Excel odrzucał go jako uszkodzony —
  dlatego skoroszyt sprawdzamy **niezależną implementacją** (`zipfile`
  w Pythonie), nie własną. Tekst wpisujemy w komórki
  (`inlineStr`), bez tablicy `sharedStrings`. Eksport przez CSV odpadł:
  w polskim Excelu kończy się kreatorem importu i przecinkiem czytanym jako
  separator tysięcy.
- `/narzedzia-8f3a/konta` — **konta do panelu i wybór narzędzi**, widoczne tylko dla
  głównego administratora. Konta powstają w Directusie z rolą **Panel**: bez wstępu
  do samego CMS-a, z uprawnieniami wyłącznie do kolekcji, które panel zapisuje
  (`boat_models`, `configurators*`, `equipment_*`) plus odczyt własnego konta.
  Rola zakłada się sama, gdy jej nie ma — identyfikatora nie ma w kodzie.
  Wybór narzędzi siedzi w `panel_ustawienia`, **nie** w uprawnieniach Directusa:
  moduły panelu nie pokrywają się z kolekcjami (jedna zakładka czyta Medusę, druga
  Allegro, trzecia nic nie zapisuje). Lista modułów: `src/lib/panel-moduly.ts`
  (czyta ją przeglądarka), sprawdzanie dostępu: `src/lib/panel-dostep.ts`.
  Administrator Directusa ma wszystko i nie da się mu tego odebrać z panelu.
  Gdy roli **nie da się sprawdzić** (brak `DIRECTUS_ADMIN_TOKEN`, milczący Directus)
  przepuszczamy wszystko — pomyłka w drugą stronę zamknęłaby właściciela przed
  własnym panelem razem z jedyną zakładką, z której da się to odkręcić.
  Konta się **zawiesza, nie kasuje**: skasowane znika z historii zmian.
- **Ustawienia panelu żyją w Directusie** (`panel_ustawienia`, klucz → JSON,
  `src/lib/panel-ustawienia.ts`, prywatna kolekcja). Stąd idą reguły cen kanałów
  i przypisania modułów do kont — zmiana narzutu z 9 na 10 procent nie wymaga
  wdrożenia. Pliki w repozytorium (`channel-pricing.ts`) zostają **zapasem**,
  tak samo jak przy konfiguratorach.
- **Reguły cen na Allegro** edytuje się w zakładce Ceny: procent, kwota
  i zaokrąglenie, osobno domyślnie i osobno jako wyjątek na kategorię (silniki
  mają inną prowizję niż drobne części). Przy wierszu stoi podpowiedź „z reguł
  1 790,00", klik wpisuje ją do pola, a zapis idzie **tą samą drogą co ręczna
  edycja** — paskiem na dole. Jest też „Wypełnij widoczne ceny Allegro z reguł".
  Nic nie zapisuje się samo. Eksport kanałów i synchronizacja liczą z tych samych
  reguł; samo liczenie i typy siedzą w `src/lib/reguly-cen.ts`, bo tabelę rysuje
  przeglądarka, a `channel-pricing.ts` sięga do Directusa kluczem administratora.
- Wejście na `/narzedzia-8f3a/ceny` pokazuje **pasek postępu z procentami**:
  odpowiedź leci strumieniem NDJSON (`?strumien=1`), kolejne linijki niosą etap
  (produkty ze sklepu, oferty z Allegro, parowanie), ostatnia komplet danych.
  Nagłówek `X-Accel-Buffering: no`, bo inaczej nginx zbuforuje postęp i dotrze
  razem z końcem, czyli po nic. Bez strumieni w przeglądarce zostaje stara droga.
- **Parametry produktu** (rodzaj silnika, moc, długość kolumny, sterowanie)
  wpisuje się przy produkcie i **wygrywają z odczytem z nazwy**. Wspólne miejsce
  dla panelu i filtrów katalogu: `src/lib/parametry.ts`; zgadywanie z nazwy
  (`product-family.ts`) zostaje jako podkładka pod 387 produktów po migracji
  z WooCommerce. Bez tego nowo dodany produkt wpadał do sklepu bez ani jednego
  filtra. Nowy parametr dokładamy **razem z filtrem**, który go używa — pole,
  którego nie ma w filtrach, to praca sprzedawcy zamieniona w nic.
- `/narzedzia-8f3a/opisy` — opisy produktów w sklepie: obecny tekst obok propozycji,
  edycja na miejscu, „Opublikuj" albo „Odłóż jako szkic". Szkice siedzą
  w metadanych produktu (`opis_propozycja`) i znikają po opublikowaniu.
  Wymaga `MEDUSA_ADMIN_TOKEN` w `.env.local` na VPS — bez klucza narzędzie
  mówi o tym wprost zamiast się wywracać.
- **Medusa 2 uwierzytelnia klucz `sk_…` przez HTTP Basic** (klucz jako login,
  puste hasło). Nagłówek `x-medusa-access-token` z Medusy 1 zwraca 401.
- **Każde żądanie do Medusy i do Allegro ma limit czasu** (20 s, `LIMIT_MS`).
  `fetch` **nie ma własnego limitu**: gdy kontener sklepu przestawał odpowiadać,
  żądanie wisiało bez końca, a panel cen stał na pasku postępu — bez błędu, bez
  danych, bez niczego. Teraz wraca czytelny komunikat z nazwą ścieżki i podpowiedzią,
  gdzie szukać (`docker ps`, `free -h`), a przy błędzie panel pokazuje przycisk
  „Spróbuj ponownie" zamiast paska, który nigdy nie ruszy.
  Panel **przerywa poprzednie pobranie** przy każdym następnym (`AbortController`)
  i przy wyjściu ze strony; strumień po stronie serwera znosi rozłączonego klienta
  bez przerywania pracy dla pozostałych.
- Cennik **czyta przeglądarka** (`xlsx-browser.ts`, `DecompressionStream`),
  a na serwer idą same wiersze. Wcześniej plik szedł w całości i nginx
  odrzucał wszystko powyżej 1 MB HTML-owym błędem 413 — narzędzie pokazywało
  wtedy „Unexpected token '<'". `readJson` tłumaczy takie odpowiedzi na
  zrozumiały komunikat, a `xlsx-parse.ts` trzyma wspólny kod dla obu stron.
- W `xlsx-parse.ts` **nie upraszczać regexpa od komórek**: pusta komórka jest
  zapisana jako `<c r="A23" s="56"/>`, bez treści i bez znacznika zamykającego.
  Wzorzec wymagający `</c>` łykał wtedy zawartość następnej komórki i cały
  arkusz przesuwał się o kolumnę. Numer wiersza bierzemy z atrybutu `r`,
  bo Excel pomija wiersze puste.
- Ścieżka narzędzi jest wyjęta z `middleware.ts` (ciasteczko języka przerzucało na
  `/en/admin/...` i wychodził 404) i ma własny `layout.tsx` — stoi poza grupami
  tras `(pl)` i `(intl)`, więc bez niego renderował się bez stylów.

## Panel Directus

- Widoki list mają **globalne presety** (`directus_presets` z `user`/`role` = null):
  kolumny i sortowanie dla `boat_models`, `brands`, `news`, `team`, `pages`
  i reszty. Bez nich Directus pokazywał samą kolumnę z numerem.
- Pola `boat_models` są w zakładkach (Podstawowe / Opisy / Dane techniczne /
  Cennik / Zdjęcia i pliki / Import ze starej strony), z polskimi nazwami
  i podpowiedziami. Duplikaty z importu są ukryte: `price` (liczy się
  `base_price`), `weight` (liczy się `displacement`), `max_people`
  (liczy się `max_persons`), `old_site_*`.
- **Konfiguratory są w Directusie**: kolekcje `configurators` (cena bazowa,
  waluta, VAT, kurs), `configurator_groups` (grupy opcji) i `configurator_options`
  (nazwa, dopłata). Przeniesione z repozytorium: 56 konfiguratorów, 190 grup,
  2958 opcji. `src/lib/configurator-source.ts` czyta Directusa (odświeżanie co
  5 minut), a dane z repo (`generated-configurators.ts`) zostają jako **zapas** —
  gdy Directus nie odpowie, konfigurator nie znika ze strony.
  Kolekcje mają publiczny odczyt, bo front pyta Directusa bez tokenu.

## Twarde zakazy (lekcje z przeszłości)

1. Żadnego czyszczenia DOM w przeglądarce à la `ModelPageCleanup` (usunięty) — potrafił
   skasować początek strony.
2. Żadnych backupów w katalogu projektu (`*.backup-*` w `src/` psuły build) — historia
   jest w gicie; backupy VPS tylko w `/opt/backups/...`.
3. Nie nadpisywać działającego headera/logo.
4. Nie commitować sekretów, tokenów ani `.env`.
5. Katalog `storage/` (PDF-y ofert) jest runtime'owy — w `.gitignore`, nie commitować.

## Czat na stronie (Chatwoot)

Klient pisze w okienku na stronie, zespół odpowiada z jednej skrzynki
(przeglądarka + aplikacja na telefon). Chatwoot jest open source i stoi na tym
samym VPS — **bez opłat za wiadomość**. Pliki wdrożeniowe: `deploy/chatwoot/`
(compose, nginx z WebSocketem, `install.sh`, README).

- Widżet wpina `src/components/ChatwootWidget.tsx`, wywoływany w stopce.
  Bez `NEXT_PUBLIC_CHATWOOT_URL` i `NEXT_PUBLIC_CHATWOOT_TOKEN` **nie ładuje
  niczego** — kod może stać na produkcji, zanim serwer czatu wystartuje.
- Dymek Chatwoota siada w tym samym rogu co WhatsApp, tuż nad jego ikoną
  (przesunięcie w `globals.css`); okno rozmowy WhatsAppa otwiera się nad
  obiema ikonami.
  Style dymka nadpisujemy w `globals.css` (`!important`, bo SDK wstrzykuje
  własne): `z-40` i odsunięcie o `--sticky-bar-h`.
- Meta nie pozwala wrzucić wiadomości ze strony wprost do WhatsAppa: rozmowę
  musi zacząć klient ze swojego numeru (wtedy 24 h odpowiedzi jest darmowe),
  albo firma szablonem — a to jest płatne. Dlatego czat na stronie i przycisk
  WhatsApp są osobnymi wejściami.

## Google i pomiar

- `src/components/Analytics.tsx` ładuje jeden `gtag.js` dla GA4 i Google Ads.
  Bez identyfikatorów **nie renderuje niczego** — strona nie odpytuje Google
  i nie zapisuje ciasteczka.
- Klucze wpisuje się **w Directusie** (`site_settings`: `ga_id`, `google_ads_id`,
  `google_site_verification`, `chatwoot_url`, `chatwoot_token`), a layouty czytają
  je z `revalidate = 300`, więc działają bez przebudowy. Zmienne środowiskowe
  z `.env.example` zostają jako wartości zapasowe.
- `merchant_feed_note` w `site_settings` trzyma adres feedu i instrukcję —
  pole tylko do odczytu, żeby klient miał link pod ręką w panelu.
- Feed produktowy do Merchant Center: `/api/merchant/feed` (RSS 2.0 z `g:`,
  ISR co godzinę). `g:id` bierze SKU z Medusy, marka z nazwy produktu,
  dostępność z `getAvailability` (`na-zamowienie` → `preorder`, `niedostepny`
  → `out_of_stock`, reszta → `in_stock`).
- **Skrypty czytają `.env` same** (`scripts/lib/env.mjs`), zamiast polegać na
  `--env-file=.env.local`. Next wczytuje `.env.local`, `.env.production` i `.env`,
  a `--env-file` widzi tylko jeden z nich — klucz ustawiony gdzie indziej wyglądał
  wtedy na nieistniejący, choć aplikacja pisała nim do Directusa co sekundę.
  Zmienna już obecna w środowisku wygrywa nad plikiem.
- Zmienne środowiskowe (SMTP, tokeny API) muszą być w `.env.local` **przed
  buildem** — część stron jest prerenderowana, więc sam restart usługi nic nie
  da. Po zmianie: `bash /root/marinero-deploy.sh --force`. To nie dotyczy
  kluczy Google i Chatwoota, jeśli wpisane są w Directusie.
- EAN produktu trzyma metadana `ean` w Medusie — feed wystawia go jako `g:gtin`,
  bez niego idzie `identifier_exists: no`.

## Kopie zapasowe cen

`scripts/kopie/ceny.mjs` zbiera ceny ze sklepu i z Allegro do
`storage/kopie-cen/` (JSON do przywracania + CSV do obejrzenia), a
`scripts/kopie/przywroc.mjs` je oddaje. README obok.

- **Przywracanie domyślnie tylko pokazuje**, co by zmieniło; zapis wymaga
  `--zapisz`. Ceny zmienia się hurtem, więc pomyłka w jednej kolumnie arkusza
  potrafi przestawić czterysta pozycji.
- Przywracamy **tylko to, co się różni** — pozycja zgodna z kopią nie generuje
  żadnego żądania.
- Zapis ceny w Medusie idzie przez **endpoint pojedynczego wariantu**;
  aktualizacja produktu traktuje tablicę `variants` jak komplet i skasowałaby
  pozostałe wersje.
- Brak Allegro nie przerywa kopii sklepu — lepiej mieć połowę niż nie mieć nic.
- Oba skrypty **zapisują odnowiony refresh token** do Directusa: odczyt ofert
  zużywa stary, więc bez tego sama kopia zapasowa położyłaby integrację.
- `storage/` przeżywa wdrożenia: `git reset --hard` nie rusza plików
  nieśledzonych.

## Formatka produktowa

`import/marinero-produkty.xlsx` — arkusz, którym sprzedawca dodaje produkty
i aktualizuje ceny (kolumna EAN włącznie). Arkusz „Obecne produkty" odświeża
`scripts/export-products.mjs` (czyta publiczne Store API, niczego nie zmienia).
Opis kolumn: `import/README.md`.
- Favicon: `src/app/icon.png`, `apple-icon.png` i `favicon.ico` — biała fala
  z logo Marinero na firmowym niebieskim. Generowane z `public/logo-marinero.png`
  (fala to komponenty spójne sięgające górnej krawędzi znaku).

## Deploy i weryfikacja (na VPS)

Cron uruchamia `/root/marinero-deploy.sh` (fetch `main` → build jako user `marinero` →
restart service). Ręczne wymuszenie: `bash /root/marinero-deploy.sh --force`.
Kopia wzorcowa skryptu leży w repo: `deploy/marinero-pl/marinero-deploy.sh` —
po zmianie trzeba ją przegrać na serwer (instrukcja w nagłówku pliku).

- **Build idzie do osobnego katalogu i dopiero gotowy podmienia `.next`**
  (`NEXT_DIST_DIR=.next-build`, `distDir` w `next.config.ts`). Wcześniej skrypt
  zatrzymywał usługę **przed** buildem, więc marinero.pl leżało kilka minut przy
  każdym wdrożeniu, a gdy build się nie udał — `set -e` przerywał skrypt przed
  `systemctl start` i strona zostawała wyłączona na dobre. Tak wyglądała awaria
  z 31 sierpnia: build nie dokończył się z braku pamięci i nikt strony nie wstał.
  Teraz nieudany build zostawia działającą poprzednią wersję, a przerwa
  w działaniu to dwa `mv` i restart.
- **Blokada `flock`**: cron wraca co 5 minut, a build trwa dłużej. Zwykle ratuje
  porównanie commitów, ale gdy w trakcie budowania wejdzie kolejny commit, drugi
  przebieg zrobiłby `git reset --hard` pod działającym buildem.
- Po nieudanym buildzie repozytorium **zostaje na nowym commicie** — cofnięte
  kazałoby cronowi próbować tego samego zepsutego wdrożenia co 5 minut w kółko.
- Smoke-test po restarcie sprawdza `/`, `/lodzie`, `/modele/aquila-42-coupe`
  i `/sklep`; gdy któryś nie odpowie 200, skrypt **wraca do poprzedniej wersji**
  (`.next.old`). Wcześniej pytał o `/modele`, który jest dziś przekierowaniem 301.
- Serwer ma 8 GB (podniesione z 4 GB 31 sierpnia). Przy 4 GB build nie mieścił
  się obok Medusy, Directusa, Postgresa i Chatwoota: zostawało 572 MB wolnego,
  swap schodził do zera i cała maszyna stawała w miejscu. Gdyby `available`
  w `free -h` znowu zeszło poniżej 2 GB, pierwszym podejrzanym jest Medusa —
  rośnie z czasem (1,33 GB po dwóch dobach pracy).
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
- Wejście w duży dział (np. Silniki, 170 pozycji) pokazuje **przegląd**:
  sekcje taksonomii, w nich kategorie z jednym zdaniem (`lead` w `SHOP_TAXONOMY`),
  szyną kilku produktów i wyjściem „zobacz wszystkie". Pełna siatka z filtrami
  wraca, gdy tylko ktoś włączy filtr, sortowanie albo wejdzie na dalszą stronę
  (`DepartmentOverview`, warunek `overview` w stronie kategorii).
- `ProductRail`/`ProductCard` w wersji `compact` chowają rząd cech („300 KM", 15")
  — to on robił połowę wysokości kafelka w szynie obok listy.
- Kategorie w Medusie mają już **drzewo**: 6 działów (Silniki, Elektronika, Części,
  Serwis, Oleje i chemia, Akcesoria) z podkategoriami, ustawione przez `parent_category_id`.
  Po imporcie z WooCommerce była to płaska lista 56 wpisów bez rodziców; kategorie
  z danych przykładowych Medusy (shirts, sweatshirts, pants, merch) zostały usunięte.
  Kolejność i etykiety menu nadal trzyma `src/lib/shop-taxonomy.ts` — zmiana menu
  to edycja tego pliku, nie panelu.
- **Liczniki działów liczą produkty, nie sumują kategorii.** Ten sam olej wisi
  w „Quicksilver" i w „Materiały eksploatacyjne", więc suma pokazywała 16 tam,
  gdzie pozycji jest 9. `departmentCategories` w `medusa.ts` dopytuje Medusę
  o prawdziwą liczbę dla działów z `sources` i to ona idzie do menu.
- Dział „Oleje i chemia" ma w Medusie własną kategorię `oleje-i-chemia`; wcześniej
  wskazywał na `oleje-suzuki`, więc otwierał się pod tytułem „Oleje", a Mercury
  i Quicksilver wyglądały na podkategorie Suzuki — ten sam błąd co przy Elektronice.
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
  indywidualnie". W Medusie płatność zostaje `pp_system_default` (ręczna).
- **PayU jest po stronie sklepu, nie Medusy.** Medusa stoi w osobnym kontenerze
  i nie da się do niej dołożyć wtyczki płatności z tego repozytorium. Dlatego
  zamówienie powstaje w Medusie jak dotąd, a zaraz po nim `/api/payu/start`
  zakłada zamówienie w PayU i odsyła klienta na jego stronę płatności.
  Wynik wraca na `/api/payu/notify` i ląduje w `metadata` zamówienia
  (`payu_status`, `payu_order_id`). Ekran powrotu: `/sklep/platnosc`.
- Dwie rzeczy w PayU, których **nie wolno rozluźnić**:
  1. **kwota pochodzi z Medusy**, nie z przeglądarki — inaczej każdy zapłaciłby
     za łódź złotówkę, a PayU potwierdziłoby taką płatność bez mrugnięcia;
  2. powiadomienie przechodzi tylko z **poprawnym podpisem** (`md5(treść +
     drugi klucz)`) **i zgodną kwotą** — bez tego wystarczyłoby wysłać nam
     „COMPLETED", żeby odebrać towar bez płacenia. Podpis liczy się z surowej
     treści żądania, więc nie parsować JSON-a przed weryfikacją.
- Bez `PAYU_POS_ID`, `PAYU_CLIENT_SECRET` i `PAYU_MD5_KEY` **opcja płatności
  online w ogóle się nie pokazuje**, a sklep działa jak dziś (przelew). Ta sama
  zasada co przy Chatwoocie i Analytics. `PAYU_ENV=sandbox` = środowisko testowe.
- Metadane zamówienia w Medusie **scalają się i nie da się skasować klucza** —
  `{"klucz": null}` zostawia klucz z wartością `null`. Kod musi to znosić
  (sprawdzamy `=== "COMPLETED"`, nie samą obecność klucza).
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
- **Elektronika to dział złożony z kilku kategorii Medusy.** Gałąź `elektronika`
  jest w Medusie pusta, a towar leży w `garmin` (34), `lowrance` (4) i `mapy` (3).
  Pole `sources` w `SHOP_TAXONOMY` mówi, z czego dział się składa, a strona listy
  pobiera produkty przez `categoryIds` (powtórzone `category_id[]` = suma).
  Wcześniej dział wskazywał wprost na `garmin`, więc kliknięcie „Elektronika"
  otwierało stronę pod tytułem „Garmin", a Lowrance wyglądał na jego podkategorię.
- Lowrance i Fusion nie są podkategoriami Garmina — `ShopSubnav` zawęża chipsy
  do sekcji, w której siedzi aktywna kategoria. Pozycje stojące **przed** pierwszym
  nagłówkiem sekcji (Garmin) tworzą własną grupę; bez tego dostawały chipsy
  cudzej sekcji.
- Mapy morskie stoją w osobnej kategorii `mapy` (wyjęte z „Garmin" w Medusie).
  `src/lib/map-compatibility.ts` oznacza, w czym karta zadziała: **Garmin
  Navionics** tylko w Garminie, samo **Navionics** także w Lowrance, Simrad,
  B&G, Raymarine i Humminbird. Sprzedawca nadpisuje to metadanymi produktu
  (`mapy_kompatybilnosc` = `garmin` | `uniwersalna`).
- Opis marki (`brands.description`) stoi na stronie marki w miejscu tekstu
zastępczego „Modele dostępne w ofercie Marinero." i jest **redagowany
w panelu**. Zajmuje **całą szerokość** karty (bez `max-w-2xl` — w wąskiej
kolumnie kilka zdań rozciągało się na dziesięć wierszy obok pustej połowy),
a na telefonie jest ucięty do trzech wierszy z „pokaż więcej"
(`src/components/ExpandableText.tsx`). Przycisk pojawia się **tylko wtedy, gdy
tekst faktycznie się nie mieści** — mierzymy `scrollHeight`, bo o obcięciu
decyduje `line-clamp`, nie liczba znaków.

**Serie Jeanneau piszemy w nazwie modelu skrótem** („S2", „S3"), a slugi zostają
bez zmian: slug to link. Merry Fisher 605, 695, 795 i 895 (także w wersji Sport)
to Série 2. Cap Camarat ma serię **inną przy każdym modelu**, więc nie da się
dopisać jej hurtem:

| Série 2 | Série 3 | bez serii |
| --- | --- | --- |
| 5.5 CC, 5.5 WA, 9.0 CC, 9.0 WA, 10.5 WA | 6.5 CC, 6.5 WA, 7.5 CC, 7.5 WA | 6.0 CC (nowość 2026), 10.5 CC, 12.5 WA |

Rozstrzyga adres modelu na jeanneau.com: przy 10.5 WA slug kończy się na
`-serie2`, przy 10.5 CC nie ma go wcale.

Wpisy w `news` mają pola `kind` (news / test / szkolenie / poradnik / **targi** /
  wydarzenie / promocja — flaga na karcie, `src/lib/news-kind.ts`) oraz
  `product_handle`. Produkt pokazujemy **wewnątrz artykułu** (panel z kadrem,
  ceną i przyciskiem), nie pod kafelkiem na liście. Gdy `kind` zostało domyślne,
  `guessNewsKind` zgaduje rodzaj z tytułu (targi, test, szkolenie…) — ręczny
  wybór w Directusie zawsze wygrywa.
- Panel „pasuje do" (`src/lib/compatibility.ts`): wystarczy **jedno** trafienie
  (próg dwóch gubił jedyną baterię Torqeedo Ultralight). Baterie Torqeedo
  rozpoznajemy po słowie „akumulator/bateria", nie po „silnik" — ich nazwy
  kończą się na „bateria do silnika".
- **„Dokup do silnika"** (`src/lib/engine-addons.ts`) — śruba napędowa i zestaw
  instalacyjny na stronie silnika zaburtowego, tak jak na starym sklepie. Tam
  były to pola dodatkowe doklejane do ceny silnika; u nas produkty są osobnymi
  wpisami w Medusie, więc dokłada się je do koszyka jako **własne pozycje** —
  w zamówieniu wychodzi to samo, a klient widzi, co kupuje.
  Pozycja wchodzi do sekcji **tylko z zakresem mocy w nazwie** („150-300KM",
  „DF9.9-20") albo z ręcznym powiązaniem `pasuje_do` w metadanych. Sam brak
  zakresu nie wystarcza: manetki Suzuki nie mają w nazwie mocy, a elektroniczna
  KLS pasuje do czego innego niż mechaniczna — pokazywanie wszystkich przy
  każdym silniku byłoby tym samym błędem, co dziurawe miniaturki przy
  wariantach silnikowych.
  **Zestawy instalacyjne zakłada `scripts/medusa/zestawy-instalacyjne.mjs`**
  (README w środku): trzy produkty — manetka topowa SPC keyless 7 700 zł,
  boczna 10 050, instalacja dwusilnikowa 14 350 — z `pasuje_do` ustawionym na
  21 silników z podpowiedzi starego sklepu (115BG/140BBG/150AP/175AP/200AP/
  250AP/300AP, same duże ze sterowaniem elektronicznym). Po migracji
  z WooCommerce ich nie było, bo na starym sklepie nie były produktami, tylko
  polem dodatkowym przy silniku. Skrypt **uruchamia się na VPS-ie**, bo
  potrzebuje `MEDUSA_ADMIN_TOKEN`.
  Pozycje pokazane w „Dokup do silnika" są wycięte z „Pasuje do", żeby ta sama
  śruba nie wyszła dwa razy na jednej stronie.
- „Zaplanuj serwis" na stronie produktu tylko przy markach spalinowych
  (Suzuki, Mercury, Quicksilver) — przy Garminie sekcja wstawiała filtry oleju.
- Tekst gwarancji to `shopWarrantyValue` w `src/lib/i18n.ts` (8 języków) —
  bez dopisku o serwisie w Gdyni.
- `ShopPageHeader` ze zdjęciem = kadr na **całą szerokość** z tytułem na nim;
  bez zdjęcia zostaje jasny nagłówek. Wąski panel obok tytułu znikał poniżej `lg`.
  Pas ma `min-h-[300px] md:min-h-[420px]` i `object-[center_58%]` — niższy kadr
  wycinał ze zdjęcia sam środek, czyli niebo i wodę, a łódź zostawała poza nim.
  Przyciemnienie jest lekkie (`from-[#0E1A2B]/70` do przezroczystości): tyle,
  ile trzeba pod tytuł przy dolnej krawędzi.
- Filtry na telefonie (`FiltersDrawer`): panel **nie zamyka się** po kliknięciu
  filtra — kliknięcia idą przez `router.push` (lista odświeża się w tle),
  a zamyka je dopiero „Pokaż N produktów". Bez JS odnośniki działają po staremu.
- Wyszukiwarka: jeden indeks dla obu pól (`src/lib/shop-search.ts`) — tego pod
  etykietami działów i tego w nakładce nagłówka. Szukamy po stronie przeglądarki,
  bo `q` w Store API dopasowuje całą frazę i gubi „suzuki 20".
- `ProductRail`: kółko myszy przewija SAME produkty. React wpina `onWheel`
  pasywnie, więc `preventDefault()` z JSX nic nie robił — listener jest wpięty
  ręcznie z `passive: false`. Na końcu szyny blokada puszcza po ~250 ms przerwy,
  żeby nikt nie utknął.
- Menu na telefonie: nagłówek „Kategorie", pod nim **działy produktów**,
  a niżej mniejsza lista stron (koszyk, łodzie, kontakt, regulamin, polityka).
- Filtry przechodzą przez `InstantLinks` (`src/components/shop/InstantLinks.tsx`) —
  ten sam wrapper na telefonie i na desktopie: kliknięcie idzie przez router,
  lista odświeża się w miejscu, strona nie skacze na górę. Bez JS zostają
  zwykłe odnośniki.
- Koszyk w nagłówku to `CartMenu` — licznik plus panel wysuwany po najechaniu
  (ten sam widok co dymek po dodaniu produktu). Panel tylko od `lg`, bo na
  dotyku nie ma najechania i odnośnik ma prowadzić wprost do koszyka.
- Tła sekcji (klasy w `globals.css`): `bg-sand-dots` — biel z piaskowymi
  kropkami (pod wyszukiwarką, co druga zajawka marki, kafelki działów);
  `bg-sand-punched` — bardzo jasny piasek z dużymi, rzadkimi białymi kropkami
  (`ShopTrust`). Oba mają być ledwie wyczuwalne — pełnych piaskowych bloków
  już nie używamy.
- „Sklep" w nagłówku serwisu i w menu na telefonie jest wyróżniony (pigułka
  z ikoną koszyka) — w rzędzie zwykłych linków ginął.
- Kafelki działów mają ikony (`src/components/shop/CategoryIcon.tsx`), nie
  zdjęcia produktów — przy zdjęciu „Serwis" wyglądał jak filtr oleju.
  Klucz to uchwyt działu, nieznane dopasowujemy po nazwie.
- Logo w nagłówkach ma `h-8 md:h-9` — przy `h-12` przytłaczało pozostałe napisy.
- Obsługa zamówień: `POST /api/zamowienia` wysyła mail do klienta
  (`src/lib/order-mail.ts`) i nadaje przesyłkę w Apaczce (`src/lib/apaczka.ts`).
  Bez SMTP zwraca `email_skipped_no_smtp`, bez `APACZKA_APP_ID` /
  `APACZKA_APP_SECRET` przesyłka leci w trybie podglądu. **Schemat podpisu
  Apaczki trzeba potwierdzić** przy pierwszym teście na koncie klienta —
  ich dokumentacja API jest za logowaniem. Endpoint chroni `ORDERS_API_TOKEN`.
- Kanały sprzedaży: reguły cen ustawia się **w panelu** (zapisane w Directusie,
  `channel-pricing.ts` jest zapasem), klient Allegro w `src/lib/allegro.ts`,
  `/api/kanaly/eksport?kanal=allegro` (CSV) i `POST /api/kanaly/sync`.
  Bez zmiennych `ALLEGRO_CLIENT_ID`, `ALLEGRO_CLIENT_SECRET`,
  `ALLEGRO_REFRESH_TOKEN` synchronizacja działa w trybie podglądu i niczego nie
  wysyła. **Refresh tokenu nie ma gdzie znaleźć** — nie leży w panelu Allegro,
  powstaje dopiero przy autoryzacji: `scripts/allegro/autoryzuj.mjs` prowadzi
  przez potwierdzenie w przeglądarce, a `sprawdz.mjs` mówi, czy klucze działają
  i ile widać ofert.
- **Allegro unieważnia refresh token przy każdej wymianie** i oddaje nowy.
  Dlatego token **nie może** siedzieć w `.env.local`: kod nie ma jak nadpisać
  pliku, więc pierwsze zapytanie działało, a każde następne dostawało
  `invalid_grant`. Token żyje w kolekcji `integration_tokens` w Directusie
  (`src/lib/allegro-token.ts`), a `.env.local` zostaje najwyżej jako wejście
  na start. Kolekcja **nie ma publicznego odczytu** — front pyta Directusa bez
  tokenu, więc `site_settings` odpada, choć byłoby wygodniej.
- Token dostępowy (12 h) trzymamy **w pamięci procesu**. To nie optymalizacja,
  tylko warunek działania: dwa zapytania wymieniające refresh token równocześnie
  unieważniłyby go sobie nawzajem. Z tego samego powodu równoległe wywołania
  czekają na jedną wymianę, zamiast robić własną.
- **Zamówienia z Allegro filtrujemy po `fulfillment.status`, nie po `status`.**
  `status=READY_FOR_PROCESSING` znaczy tylko tyle, że kupujący wypełnił formularz
  zakupu — wpadały tam paczki dawno wysłane i odebrane, więc zakładka
  „do obsłużenia" pokazywała robotę, której nie było. Widoki (Do obsłużenia, Nowe,
  W realizacji, Gotowe do wysyłki, Wysłane, Odebrane, Wszystkie) siedzą
  w `src/lib/allegro-widoki.ts` — czyta je też panel w przeglądarce, a `allegro.ts`
  ciągnie za sobą klucze konta sprzedażowego. Gdyby konto nie przyjęło filtra,
  powtarzamy zapytanie bez niego i odsiewamy u siebie.
- **Zamówienia przychodzą ze wszystkich rynków Allegro naraz** (`allegro-pl`,
  `-cz`, `-sk`, `-hu`) — nie da się tego wyłączyć w API i nie ma po co: oferta
  wystawiona w Polsce jest widoczna także u sąsiadów. Zagraniczne są podpisane
  rynkiem, a lista obok zakładek zawęża widok do jednego kraju.
- `/me` w Allegro wymaga osobnego uprawnienia do profilu, którego nie mamy
  i nie potrzebujemy — 403 w tym miejscu nie jest awarią. Oferty łączymy z produktami po SKU (`external.id` w Allegro).
  Endpoint chroni `CHANNEL_SYNC_TOKEN` (nagłówek `x-sync-token`).
- Pole `fields` w Store API: nazwa bez plusa (`metadata`) przełącza Medusę w tryb
  „tylko te pola" i gubi `handle`/`title`/`description`. Zawsze `+metadata`,
  `+variants.sku`.
- **Konta klientów** (`/sklep/konto`, `src/lib/klient.ts`) są **dodatkiem, nie
  warunkiem zakupu** — kasa dla gościa działa dokładnie tak jak przedtem i nie
  wolno jej uzależnić od logowania. Token z Medusy siedzi w ciasteczku
  `httpOnly` `marinero_klient`; do przeglądarki nie trafia nic, czym dałoby się
  podszyć pod klienta.
  Rejestracja ma **trzy kroki**: `/auth/customer/emailpass/register` →
  `POST /store/customers` (profil) → **ponowne logowanie**. Token z rejestracji
  ma puste `actor_id`, więc `/store/customers/me` odbija go z 401 — zapisany
  w ciasteczku dałby konto, do którego nie da się wejść.
  Historia zamówień idzie **po adresie e-mail, kluczem administratora**, a nie
  po koncie: kasa dla gościa nie przypisuje zamówień do klienta, więc pytanie
  Medusy o zamówienia zalogowanego dałoby pustą listę każdemu, kto kupował
  przed założeniem konta. Adres bierzemy z potwierdzonej sesji, nigdy
  z przeglądarki, i porównujemy dokładnie — to jedyne miejsce decydujące,
  czyje zamówienie klient zobaczy.
  `/api/konto` oddaje JSON **także przy awarii**, a zapytania do Medusy mają
  ograniczenie czasu (15 s). Bez tego wyjątek kończył się stroną błędu w HTML-u,
  formularz nie umiał jej odczytać i pokazywał „brak połączenia" niezależnie od
  tego, co się naprawdę stało — łącznie z przypadkiem, w którym konto powstało.
  Nagłówek pokazuje **zwykły odnośnik „Moje konto"**, nie stan zalogowania:
  sięgnięcie po ciasteczko w nagłówku wyłączyłoby ISR na wszystkich stronach
  sklepu. Z tego samego powodu kasa pyta o dane zalogowanego przez
  `GET /api/konto` z przeglądarki i podstawia je **tylko w puste pola**.
- **Konto pokazuje pełne zamówienie**, nie samą sumę: pozycje ze zdjęciem
  i **odnośnikiem do produktu w sklepie** (`/sklep/produkt/{handle}`), adres
  dostawy, sposób wysyłki, rozbicie kwoty, stan obsługi z panelu
  (`metadata.obsluga`) i zasady zwrotu. Adres produktu bierzemy z migawki przy
  pozycji zamówienia (`items.product_handle`), więc działa także wtedy, gdy
  produkt zniknął z katalogu; bez `handle` zostaje sam napis, nie link donikąd.
- **Śledzenie przesyłki wymaga przewoźnika, nie tylko numeru.** Panel zapisuje
  obok numeru `metadata.przesylka_przewoznik`, a `src/lib/przewoznicy.ts` (wolny
  od sieci — czyta go panel i konto klienta) buduje z tej pary odnośnik wprost
  do śledzenia. Bez przewoźnika pokazujemy sam numer: zgadywanie firmy po
  kształcie numeru kończy się odesłaniem klienta do cudzej wyszukiwarki.
- **Reset hasła: front ma całą ścieżkę, brakuje ogniwa po stronie Medusy.**
  `/sklep/konto/reset` woła `POST /auth/customer/emailpass/reset-password`,
  `/sklep/konto/nowe-haslo?token=…&email=…` woła
  `POST /auth/customer/emailpass/update` i od razu loguje. Medusa **nie oddaje
  tokenu w odpowiedzi** (`201`, pusta treść) — emituje zdarzenie
  `auth.password_reset` wewnątrz swojego kontenera, a token sesji na `update`
  wraca z `401 Invalid token` (sprawdzone na żywym API). Token przynosi mały
  subskrybent po stronie Medusy, gotowy w `deploy/medusa/reset-hasla/`; mail
  wysyła front (`/api/konto/reset-mail`), żeby SMTP i szablon zostały w jednym
  miejscu. Końcówkę chroni `RESET_HOOK_TOKEN` — bez niego oddaje `503`
  i nie wysyła niczego, bo otwarta pozwalałaby komukolwiek wysyłać z naszej
  skrzynki listy „zresetuj hasło" z linkiem własnego wyrobu.
  Formularz **zawsze odpowiada tak samo** („jeśli mamy konto na ten adres…"),
  niezależnie od tego, czy konto istnieje — inaczej odpowiadałby na pytanie,
  które adresy mają u nas konto.
- Koszyk trzyma id w `localStorage` (`marinero_cart_id`); gdy koszyk wygaśnie w Medusie,
  klient czyści wpis i zaczyna nowy.
- Instalacja ma jeszcze kategorie z danych przykładowych Medusy (shirts, pants…) —
  są odfiltrowane w `getShopCategories`, tak jak kategorie bez produktów.
- Uwaga przy testach lokalnych: w sandboxie `fetch` w Node nie przechodzi przez proxy
  do hosta Medusy — serwer trzeba uruchamiać z `NODE_USE_ENV_PROXY=1`. Na VPS to zbędne.
