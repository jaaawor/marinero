# Cennik Stinga

Sting wysyła jeden skoroszyt na sezon (`Sting_Boats_and_Options_prices_MY25.xlsx`):
arkusz **„Sting Boats prices ex.vat"** z cenami łodzi w wariantach silnikowych
i po jednym arkuszu opcji na model („485 S Options", „PRO 725 Cabin Options"…).

## Jak wgrać nowy cennik

```bash
cp ~/Pobrane/Sting_*.xlsx scripts/sting/dane/

export DIRECTUS_TOKEN=...
python3 scripts/sting/import.py                              # przebieg na sucho
python3 scripts/sting/import.py --szczegoly sting-725-pro    # z każdą pozycją
python3 scripts/sting/import.py --zapis
```

Katalog `dane/` jest w `.gitignore`. Skrypt bierze **najnowszy** plik `.xlsx`
z tego katalogu.

## Co trzeba uzupełnić przy nowym sezonie

`nazwy.json` — tłumaczenia nazw silników i opcji. Każda nowa pozycja zgłasza
się przy imporcie jako `! brak tłumaczenia` i wtedy trzeba ją dopisać; skrypt
niczego nie zgaduje.

Gdy producent doda model, dochodzi wpis w `ARKUSZE` (arkusz opcji → nasz slug)
i `MODELE` (nazwa z arkusza cen → ten sam slug) w `import.py`. Cennik nazywa
łodzie inaczej niż nasz katalog — „PRO 725 Open" to u nas „Sting 725 Pro".

## Dlaczego tak, a nie inaczej

- **Cena bazowa konfiguratora zostaje 0**, tak jak przy XO: cennik podaje cenę
  łodzi **razem z silnikiem**, więc to wybór silnika niesie całą kwotę.
  Wpisanie ceny bazowej obok tego liczyłoby kadłub dwa razy.
- **„STD" i „-" to nie są opcje.** Pierwsze znaczy, że pozycja jest na tym
  modelu w standardzie, drugie — że jest niedostępna. Doliczanie ich do oferty
  byłoby błędem w obie strony.
- **Kod katalogowy producenta** (`OP_014_S_725_PRO_C`) idzie do
  `configurator_options.code`, więc następny cennik dopasuje się po kodzie,
  a nie po nazwie.
- **Najpierw wstawiamy, potem kasujemy** i przenosimy zdjęcia opcji na nowe
  wpisy — te same zasady co przy XO.

## Czego w cenniku nie ma

- **Sting 470 Pro** — nie występuje w cenniku MY25, więc zostaje bez
  konfiguratora.
- **Sting 725 Pro T-Top** — ma stronę w katalogu, ale producent nie podaje ani
  ceny, ani arkusza opcji.
