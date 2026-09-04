# Ceny silników w konfiguratorach

Ten sam silnik stoi przy kilku łodziach i przy każdej ma dziś **inną cenę** —
bo cennik producenta wchodził do każdej osobno, w różnych miesiącach. Przy XO
Suzuki 300 KM BTX kosztuje 26 740 EUR przy trzech łodziach, 27 180 przy trzech
innych i 33 296 przy DFNDR 8. To jest jeden i ten sam silnik.

Cennik rozwiązuje to tak: cenę podaje się **raz**, w złotych brutto (bo w takich
przychodzi od dostawcy), osobno silnik i osobno zestaw instalacyjny. Wariant
silnikowy przy łodzi liczy się z niej sam:

```
(silnik + zestaw) ÷ 1,23 ÷ kurs        = cena silnika w EUR netto
cena „bez silnika" + cena silnika      = cena wariantu przy tej łodzi
```

Przy XO cena bazowa konfiguratora wynosi **0**, a cenę kadłuba niesie pozycja
„Bez silnika" — stąd to dodawanie. Przy markach z normalną ceną bazową wariant
silnikowy nie zawiera kadłuba i dodaje się do zera.

## Gdzie się to edytuje

**W panelu**: `/narzedzia-8f3a/silniki`. Kurs i VAT są na górze strony, pod
tabelą stoi podgląd „było → będzie" dla każdej łodzi.

Dwa przyciski, bo to są dwie różne decyzje:

- **Zapisz cennik** — odkłada kwoty, nie rusza niczego na stronie. Cennik można
  uzupełniać tygodniami.
- **Przepisz do konfiguratorów** — dopiero to zmienia ceny, które widzi klient
  (od najbliższego odświeżenia ISR, do 5 minut).

Każda pozycja zapisuje się osobnym żądaniem i osobno zdaje raport: przy
trzydziestu opcjach jedna odrzucona nie może przewrócić pozostałych ani zostawić
nas bez wiedzy, która to była.

## Wypełnienie startowe

`cennik-start.mjs` wpisuje ceny z arkusza wypełnionego przez klienta (XO,
Suzuki, wrzesień 2026) — żeby nie przepisywać dziesięciu pozycji ręcznie.

```
node scripts/silniki/cennik-start.mjs            # podgląd
node scripts/silniki/cennik-start.mjs --zapisz   # zapisuje (na VPS-ie)
```

Domyślnie **nie nadpisuje** tego, co już jest: cennik poprawiony w panelu jest
świeższy niż plik w repozytorium. `--nadpisz` wymusza. Skrypt **nie rusza cen
w konfiguratorach** — to zostaje kliknięciem w panelu, po obejrzeniu podglądu.

## Klucz, czyli po czym wiążemy cennik z opcjami

Nazwy tej samej pozycji są w Directusie zapisane na kilka sposobów: `Suzuki DF
250 APX`, `Suzuki DF250APX`, `Suzuki 250 KM APX`. Dlatego kluczem jest nazwa bez
spacji, bez nawiasów i bez oznaczeń `DF` i `KM`, z zachowaną liczbą silników
(`2|suzuki250apx`). Nazwę **docelową** wpisuje się w cenniku i przy przepisywaniu
wchodzi ona do wszystkich łodzi — stąd ujednolicenie przy okazji zmiany ceny.

Uwaga: `Suzuki 250 KM` (DFNDR 8) i `Suzuki 250 KM APX` (reszta) to dziś **dwa
różne klucze**, bo w nazwie brakuje `APX`. W cenniku są więc dwa wiersze z tą
samą ceną i tą samą nazwą docelową — po przepisaniu obie łodzie mają jedną
nazwę, a przy następnym przebiegu klucze się zejdą.
