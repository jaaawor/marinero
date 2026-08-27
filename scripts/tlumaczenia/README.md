# Tłumaczenia treści z paneli

Słownik interfejsu siedzi w `src/lib/i18n.ts` — to napisy, które piszemy
w kodzie. Tutaj chodzi o coś innego: **treść redagowaną w panelach** (opisy
modeli, aktualności, nazwy opcji konfiguratora, wyposażenie standardowe, nazwy
i opisy produktów w sklepie). Tego nie da się trzymać w repozytorium, bo klient
poprawia to u siebie.

Tłumaczenia leżą w kolekcji **`content_translations`** w Directusie i tam się je
poprawia. Kluczem jest **skrót polskiego tekstu**, nie identyfikator rekordu:

- ten sam napis tłumaczy się **raz dla całego serwisu** — „Lodówka szufladowa"
  stoi przy kilkunastu łodziach;
- działa tak samo dla **Medusy**, do której nie da się dołożyć pól;
- poprawka polskiego tekstu **nie podmienia po cichu tłumaczenia** — zmienia się
  skrót, więc front wraca do oryginału, dopóki ktoś nie doda nowego wpisu.

Front czyta to przez `src/lib/content-translations.ts` (odświeżanie co 5 minut,
publiczny odczyt, jak przy konfiguratorach).

## Jak dorobić brakujące tłumaczenia

```bash
# 1. co jeszcze nie jest przetłumaczone
node scripts/tlumaczenia/eksport.mjs

# 2. paczki do `do-zrobienia/`
node scripts/tlumaczenia/eksport.mjs --paczki

# 3. tłumaczenie → `gotowe/NNN.json` (zapis niżej)

# 4. wgranie do Directusa
DIRECTUS_TOKEN=... node scripts/tlumaczenia/import.mjs           # na sucho
DIRECTUS_TOKEN=... node scripts/tlumaczenia/import.mjs --zapis
```

Paczki są **dwojakie**, bo teksty są dwojakie. Nazwy opcji i wyposażenia to
jedno–dwa słowa, więc idą po `PACZKA = 120` sztuk. Opisy modeli, artykuły
i opisy produktów mają po kilkanaście tysięcy znaków — te (powyżej `DLUGI`,
czyli 1200 znaków) dzielimy **budżetem znaków** (`ZNAKOW_W_PACZCE = 6000`),
a nie liczbą sztuk, więc jeden długi artykuł bywa całą paczką. Sto długich
tekstów w jednej paczce nie zmieściłoby się w odpowiedzi.

Wgrane pary (`do-zrobienia/NNN.json` + `gotowe/NNN.json`) przenosimy do
**`wgrane/`** (`wgrane/zrodla/` i `wgrane/gotowe/`), żeby kolejny przebieg
`--paczki` numerował od nowa i nie mieszał starych paczek z nowymi. Historia
tłumaczeń zostaje w repozytorium — po zmianie polskiego tekstu skrót jest inny,
więc stara para nikomu nie szkodzi, a widać, co już poszło do Directusa.

Token administratora **nie wchodzi do repozytorium** — podaje się go w zmiennej
środowiskowej przy uruchomieniu.

## Zapis paczek

`do-zrobienia/NNN.json` — teksty do przetłumaczenia, z kontekstem:

```json
{ "jezyki": ["en","de","fr","ru","uk","it","es"],
  "teksty": [ { "hash": "4f3a…", "source": "Zlew", "context": "wyposażenie standardowe" } ] }
```

`gotowe/NNN.json` — **zapis zwarty**: tablica w tej samej kolejności co paczka
wyjściowa, wiersz to skrót (pierwsze 8 znaków, jako zabezpieczenie) i siedem
tłumaczeń w kolejności języków:

```json
{ "paczka": "001",
  "tlumaczenia": [ ["4f3a1b2c", "Sink", "Spüle", "Évier", "Раковина", "Мийка", "Lavello", "Fregadero"] ] }
```

Import sprawdza długość tablicy i skróty — pomylona kolejność wywala się od
razu, zamiast wgrać tłumaczenia pod nie te teksty.

## Czego nie tłumaczymy

- **Nazwy modeli i marek** („Nordkapp Avant 605", „Aquila 42 Coupe") — to nazwy
  własne, w każdym języku brzmią tak samo.
- **Teksty dłuższe niż `MAX_ZNAKOW` (25 000 znaków)** — zlepki HTML-a
  przeniesione z WooCommerce, całe tabele ze znacznikami. Zanim je
  przetłumaczymy, trzeba je przepisać; od tego jest `/admin/opisy`. Krótsze
  opisy i artykuły tłumaczymy normalnie — wcześniejszy próg 3000 znaków
  zostawiał bez tłumaczenia wszystkie opisy modeli i całe aktualności, czyli
  akurat te teksty, które klient na stronie czyta.
- **Regulamin i polityka prywatności** — teksty prawne, które w tłumaczeniu
  maszynowym potrafią zmienić znaczenie. Wymagają tłumacza, a w sklepie i tak
  wskazuje się, która wersja językowa jest wiążąca.

## Poprawianie w panelu

Każdy wpis ma pole **„maszynowe"**. Skrypt wgrywa tłumaczenia z tym znacznikiem
i **nie nadpisuje** wpisów, z których ktoś ten znacznik zdjął — poprawka
człowieka jest ważniejsza niż kolejny przebieg automatu.
