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

python3 scripts/sting/wyposazenie.py --odswiez     # wyposażenie standardowe ze strony
python3 scripts/sting/wyposazenie.py --zapis
```

Katalog `dane/` jest w `.gitignore`. Skrypt bierze **najnowszy** plik `.xlsx`
z tego katalogu.

## Co trzeba uzupełnić przy nowym sezonie

`nazwy.json` — tłumaczenia nazw silników i opcji, `wyposazenie.json` —
wyposażenia standardowego ze strony producenta. Każda nowa pozycja zgłasza
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

## Wyposażenie standardowe

Cennik go nie zawiera — odsyła na stronę („Standard equipment listed on
www.sting-boats.com"). `wyposazenie.py` czyta je ze znacznika
`<script id="model_boat" type="application/json">` na stronie modelu, tak samo
jak przy Nordkappie: obie marki należą do Frydenbø i stoją na tym samym
silniku strony. Lista producenta jest krótka (9–16 pozycji na model) — tyle
publikuje. Dopisywanie własnych pozycji zostaje przy `/admin/wyposazenie`.

Adresy modeli u producenta trzyma tabela `MODELE` w `wyposazenie.py`: Sting
dzieli łodzie na „console" i „utility", więc samej nazwy nie da się złożyć
w adres.

## Czego w cenniku nie ma

- **Sting 470 Pro** — nie występuje w cenniku MY25, więc zostaje bez
  konfiguratora (wyposażenie standardowe ma, bo to idzie ze strony).
- **Sting 725 Pro T-Top** — ma stronę w katalogu, ale producent nie podaje ani
  ceny, ani arkusza opcji (wyposażenie standardowe też ma).
