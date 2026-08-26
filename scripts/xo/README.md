# Cenniki XO

XO wysyła na sezon jeden skoroszyt na model — „XO EXPLR 9 Order Form
01.05.2026.xlsx". Każdy ma cztery arkusze: **Order form** (cennik opcji),
**Boat Standard** (wyposażenie standardowe), **Layout** (rzuty) i **Upholstery**
(tapicerki ze zdjęciami próbek). Te skrypty przepisują to wszystko do Directusa.

## Jak wgrać nowy cennik

```bash
cp ~/Pobrane/XO_*.xlsx scripts/xo/dane/
npx tsx scripts/xo/czytaj.ts scripts/xo/dane/*.xlsx      # → dane/xo.json

export DIRECTUS_TOKEN=...
python3 scripts/xo/import.py                             # przebieg na sucho
python3 scripts/xo/import.py --szczegoly xo-dfndr-8      # z każdą pozycją
python3 scripts/xo/import.py --zapis

python3 scripts/xo/wyposazenie.py                        # wyposażenie standardowe
python3 scripts/xo/wyposazenie.py --zapis

python3 scripts/xo/zdjecia.py --odswiez                  # zdjęcia opcji ze strony XO
python3 scripts/xo/zdjecia.py --zapis
```

Katalog `dane/` jest w `.gitignore` — skoroszytów nie trzymamy w repozytorium.

## Co trzeba uzupełnić przy nowym sezonie

Skrypty **nie zgadują** tłumaczeń. Każda nowa pozycja cennika zgłasza się jako
`! brak tłumaczenia` i trzeba ją dopisać:

| plik | co trzyma |
|---|---|
| `nazwy-1.json`, `nazwy-2.json`, `nazwy-3.json` | nazwy opcji z „Order form" (angielski → polski) |
| `wyposazenie.json` | wyposażenie standardowe z „Boat Standard" |
| `tapicerki.json` | opisy materiałów i rozmiary plików ze zdjęciami próbek |
| `nasze.json` | nasze pozycje spoza cennika XO (Suzuki, COX) i pozycje pomijane |
| `zdjecia.json` | zdjęcia opcji ze strony producenta → nasze nazwy opcji |

## Dlaczego tak, a nie inaczej

- **Cena bazowa konfiguratora zostaje 0.** U XO cenę łodzi niesie wybór silnika
  — pozycja „Mercury Verado 300 KM V8" to cena całej łodzi z tym silnikiem.
  Wpisanie obok tego ceny bazowej liczyłoby kadłub dwa razy (tak było przy
  DFNDR 8: baza 72 000 € plus 109 000 € za wariant silnikowy).
- **Cena kadłuba bez silnika** stoi w pierwszym wierszu formularza i wchodzi
  jako pozycja „Bez silnika". Zaznaczony domyślnie jest najtańszy wariant
  **z silnikiem** — strona modelu otwarta na „bez silnika" wygląda na
  niedokończoną ofertę.
- **Nasze pozycje przeliczamy o różnicę ceny bazowej.** Gdy producent podnosi
  cenę kadłuba, silnik Suzuki kosztuje tyle co wcześniej — zmienił się kadłub.
  W `nasze.json` leży więc cena z dnia, w którym ją ustalono, razem z bazą
  z tamtego cennika (`stara_baza`); import dolicza różnicę do bieżącej bazy.
  Tego pliku **nie ruszamy** przy zwykłej aktualizacji cennika — dopiero gdy
  zmienia się cena samego silnika (wtedy razem z `stara_baza`).
- **Zdjęcia opcji są ze strony, nie z cennika.** Formularz zamówienia nie ma
  ani jednego kadru; katalog pod `xoboats.com/configurator` ma je przy 135
  pozycjach. Nazwy na stronie są krótsze i starsze niż w formularzu
  („Bow thruster 2.0KW" wobec „Bow thruster Lewmar 2.0 kW"), więc parujemy je
  tabelą `zdjecia.json`, a nie po podobieństwie. Import przenosi zdjęcie na
  nowy wpis po nazwie opcji — inaczej każdy kolejny cennik kasowałby cały
  dorobek zdjęciowy.
- **Arkusz „Layout" to rendery kolorów kadłuba** (w środku ma tytuł COLOUR
  COMBINATION ILLUSTRATIONS), nie rzuty. Etykieta stoi w wierszu nad obrazkiem,
  więc każdy render przypisujemy do najbliższej etykiety powyżej. Grupa „Kolor
  kadłuba i pokładu" przechodzi wtedy na kafelki.
- **Zdjęcia próbek tapicerki rozpoznajemy po rozmiarze pliku.** W skoroszycie
  są zakotwiczone przy wierszach, ale kotwica bywa przesunięta o wiersz i przy
  jednym wierszu potrafią wisieć dwa obrazki. Ten sam plik jest za to w każdym
  skoroszycie co do bajta.
- **Najpierw wstawiamy, potem kasujemy.** Odwrotna kolejność przy zerwanym
  połączeniu zostawia łódź z pustą grupą. Nadmiar da się usunąć, braku nie.
- **Grupy z poprzedniego układu znikają.** Po zmianie tytułu („Kolor tapicerki"
  → „Tapicerka kabiny") stara grupa wisiałaby obok nowej z tymi samymi opcjami.
  Nie ruszamy tylko grup związanych z marką silnika (`engine_brand`) — kolory
  Suzuki mają własne zdjęcia, a w cenniku XO ich nie ma.
