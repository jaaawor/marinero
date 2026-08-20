# Kadry marek — PLACEHOLDERY DO PODMIANY

Pliki w tym katalogu to **zdjęcia poglądowe**, pobrane z publicznych stron
producentów, żeby pokazać, jak działa sekcja zajawek marek na stronie sklepu.

Do wersji produkcyjnej trzeba je wymienić na materiały z oficjalnych media
kitów (jako autoryzowany dealer Marinero ma do nich dostęp) albo na własne
zdjęcia z Gdyni.

| plik | źródło poglądowe | co powinno tu trafić |
|---|---|---|
| `garmin.jpg` | res.garmin.com (kokpit z ploterem) | zdjęcie ze stanowiska sterowego z ploterem Garmin |
| `torqeedo.jpg` | torqeedo.com (kajak z Ultralight) | łódź z silnikiem Torqeedo |
| `suzuki.png` | assets.suzukimarine.com (render DF250A) | silnik Suzuki na pawęży albo zdjęcie z wody |
| `mercury.*` | **brak** — mercurymarine.com blokuje pobieranie (HTTP 403) | zdjęcie z materiałów Mercury |

Bez pliku sekcja marki bierze kadr z galerii modeli w Directusie, więc nic
się nie psuje — po prostu nie ma zdjęcia tej konkretnej marki.

Nazwy plików są brane z `src/lib/shop-brands.ts` — podmiana pliku o tej samej
nazwie wystarczy, kodu nie trzeba ruszać.
