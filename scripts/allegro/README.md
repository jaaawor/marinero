# Allegro — podpięcie konta sprzedażowego

Cel: widzieć w jednym miejscu ceny ze sklepu obok cen, które stoją na Allegro,
i móc je z czasem ustalać z jednego miejsca. Na razie **tylko odczyt** —
`/admin/kanaly` pobiera oferty i pokazuje je obok cen sklepowych, nic nie wysyła.

## Raz: aplikacja w Allegro

1. https://apps.developer.allegro.pl → *Moje aplikacje* → **Zarejestruj nową aplikację**.
2. Typ: **aplikacja bez dostępu przez przeglądarkę** (device flow).
3. Uprawnienia: `allegro:api:sale:offers:read` i `allegro:api:sale:offers:write`
   (zapis przyda się, gdy ceny zaczniemy wysyłać — teraz nieużywany).
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

## Co dalej

Ceny liczone z reguł (`src/lib/channel-pricing.ts`) i wysyłka na portal siedzą
już w `POST /api/kanaly/sync`. Włączamy je dopiero, gdy klient zdecyduje, które
kategorie mają się przeliczać automatycznie — dziś kolumna „wg reguły" jest
wyłącznie podpowiedzią.
