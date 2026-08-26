# Cenniki Aquili

Aquila wysyła **osobny skoroszyt na model** (`Aquila_42Y_Pricing_7.1.25.xlsx`):
jeden arkusz, ceny w USD. Układ jest zawsze ten sam — wiersz z ceną łodzi
bazowej, a pod nim sekcje oddzielone pustym wierszem (Engine, Hull Color,
Electronics Package…). Kolumna A trzyma nazwę sekcji, D opis pozycji, I cenę.

## Jak wgrać nowe cenniki

```bash
cp ~/Pobrane/Aquila_*.xlsx scripts/aquila/dane/

export DIRECTUS_TOKEN=...
python3 scripts/aquila/import.py                          # przebieg na sucho
python3 scripts/aquila/import.py --szczegoly aquila-42-yacht
python3 scripts/aquila/import.py --zapis
```

Skrypt bierze **wszystkie** pliki `.xlsx` z `dane/` i sam rozpoznaje, która to
łódź — po tytule w środku skoroszytu, nie po nazwie pliku. Katalog `dane/`
jest w `.gitignore`.

## Co trzeba uzupełnić przy nowym cenniku

`nazwy.json` — nazwy sekcji i opcji po polsku. Każda nowa pozycja zgłasza się
przy imporcie jako `! brak tłumaczenia`; skrypt niczego nie zgaduje. Przy
nowym modelu dochodzi wzorzec w `SLUGI` w `import.py`.

## Dlaczego tak, a nie inaczej

- **Cena bazowa konfiguratora zostaje 0**, a wariant silnikowy niesie całą
  cenę łodzi — tak działały konfiguratory Aquili od początku i tak samo robimy
  przy XO. W cenniku silnik standardowy kosztuje 0, więc doliczamy do niego
  cenę bazową z pierwszego wiersza.
- **Sekcje rozdziela pusty wiersz**, a nazwa sekcji nie zawsze stoi w jego
  pierwszym wierszu: przy 42 Yacht wariant standardowy silnika leży *nad*
  etykietą „Engine". Dlatego dzielimy arkusz na bloki po przerwie w numeracji,
  a etykietę bierzemy z całego bloku — inaczej silnik standardowy wpadał do
  sekcji „Voltage", a najtańszy wariant w konfiguratorze był o 25 000 $ za drogi.
- **Sekcja silnikowa bywa nazwana „Power"** (28 Molokai Cuddy). To ona niesie
  cenę łodzi, więc trzeba ją rozpoznać po obu nazwach.
- **Napięcie instalacji nie ma opisu** — wariant („110 V") siedzi w kolumnie
  ceny. Bez tej reguły grupa wychodziła pusta.
- **Z grupy radio trzeba móc wyjść.** Kolory i układy kabin mają w cenniku
  wariant standardowy za 0, ale pakiety (elektronika, foile, Upgrade Package)
  już nie — dostają pozycję „Tylko wyposażenie standardowe", tak samo jak
  pakiety Nordkappa. Silnika to nie dotyczy: jakiś trzeba wybrać.
- **Wiersz „Total for boat Ex Shanghai shipping port"** to podsumowanie
  arkusza, nie pozycja do wyboru — pomijamy go.
- **Nazwy przenosimy z poprzedniego wydania konfiguratorów**, sparowane po
  cenie w obrębie jednej łodzi (107 ze 151 przy pierwszej partii). Dzięki temu
  nie tłumaczyliśmy dwa razy tego samego i klient dostaje nazwy, które już zna.
