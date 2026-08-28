# Allegro — podpięcie konta sprzedażowego

Cel: widzieć w jednym miejscu ceny ze sklepu obok cen, które stoją na Allegro,
i móc je z czasem ustalać z jednego miejsca. Na razie **tylko odczyt** —
`/admin/kanaly` pobiera oferty i pokazuje je obok cen sklepowych, nic nie wysyła.

## Raz: aplikacja w Allegro

1. https://apps.developer.allegro.pl → *Moje aplikacje* → **Zarejestruj nową aplikację**.
2. Typ: **aplikacja bez dostępu przez przeglądarkę** (device flow).
3. Uprawnienia: `allegro:api:sale:offers:read`, `allegro:api:sale:offers:write`,
   `allegro:api:orders:read`, `allegro:api:orders:write`,
   `allegro:api:shipments:read`, `allegro:api:shipments:write`.
   Zamówienia i przesyłki są potrzebne do obsługi sprzedaży z poziomu narzędzi;
   zapis ofert przyda się, gdy ceny zaczniemy wysyłać — dziś nieużywany.
4. Zapisz **Client ID** i **Client Secret**.

## Raz: zgoda właściciela konta

```bash
cd /opt/marinero-frontend
ALLEGRO_CLIENT_ID=... ALLEGRO_CLIENT_SECRET=... node scripts/allegro/token.mjs
```

Skrypt wypisze adres i kod. Otwórz adres w przeglądarce **zalogowanej na konto
sprzedażowe Marinero**, potwierdź dostęp i wróć do terminala — po chwili pojawią
się trzy linie do wklejenia w `/opt/marinero-frontend/.env.local`:

```
ALLEGRO_CLIENT_ID=...
ALLEGRO_CLIENT_SECRET=...
ALLEGRO_REFRESH_TOKEN=...
```

Potem `bash /root/marinero-deploy.sh --force`.

**Tych linii nie wolno commitować** — to dostęp do konta sprzedażowego.
Refresh token nie wygasa, dopóki się go używa; jeśli kiedyś przestanie działać,
wystarczy powtórzyć ten sam krok.

## Jak oferta łączy się z produktem

Po **sygnaturze sprzedawcy** (`external.id` w Allegro), w którą wpisujemy SKU
z Medusy. Dopasowanie po nazwie jest bezużyteczne: tytuł na Allegro jest
przycięty do limitu znaków i doprawiony słowami kluczowymi, więc „Suzuki DF 9.9
BS" bywa tam „Silnik zaburtowy SUZUKI DF9,9 BS 9,9KM 4-suw KRÓTKA KOLUMNA".

Oferty bez sygnatury `/admin/kanaly` wypisuje osobno — to one wypadną
z synchronizacji, dopóki ktoś nie uzupełni w nich SKU.

## Obsługa zamówień

`/narzedzia-8f3a/zamowienia-allegro` pokazuje zamówienia czekające na obsługę
i pozwala je poprowadzić bez wchodzenia na portal: przyjąć do realizacji, wpisać
numer przesyłki i oznaczyć jako wysłane. Zmiany idą wprost do Allegro i kupujący
widzi je u siebie w „Moich zakupach".

Trzy rzeczy wynikające z tego, jak działa Allegro:

- **Numer przesyłki zapisujemy przed stanem „wysłane"**, jednym kliknięciem.
  Odwrotna kolejność daje kupującemu powiadomienie o wysyłce bez numeru do
  śledzenia — i telefon z pytaniem, gdzie jest paczka.
- **Opłacenie jest osobne od stanu realizacji.** Zamówienie nieopłacone wygląda
  na liście tak samo jak opłacone, więc stan płatności stoi obok stanu realizacji,
  a przycisk wysyłki jest przy nieopłaconym wyłączony.
- **Płatności i zwroty zostają po stronie Allegro** — tego nie ruszamy.

Do zapytań doklejamy nagłówek `User-Agent` (`ALLEGRO_USER_AGENT`, domyślnie
`marinero-sklep/1 (+marinero.pl)`). Allegro wymaga, żeby integracja się
przedstawiała: bez tego przy przekroczeniu limitów blokują całe konto, a nie
jedną integrację.

## Co dalej

Ceny liczone z reguł (`src/lib/channel-pricing.ts`) i wysyłka na portal siedzą
już w `POST /api/kanaly/sync`. Włączamy je dopiero, gdy klient zdecyduje, które
kategorie mają się przeliczać automatycznie — dziś kolumna „wg reguły" jest
wyłącznie podpowiedzią.
