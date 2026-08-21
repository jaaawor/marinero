# Formatka produktowa

`marinero-produkty.xlsx` — jeden plik do dodawania nowych produktów
i aktualizacji istniejących (ceny, dostępność, EAN-y).

## Jak to działa

1. Sprzedawca wypełnia arkusz **Produkty** i odsyła plik.
2. Wgranie do Medusy jest po naszej stronie — klient nie dotyka panelu.

Arkusz **Obecne produkty** trzyma aktualny stan sklepu (SKU, nazwa, cena,
kategoria, dostępność, EAN), żeby było skąd przepisać SKU. Odświeżenie:

```
node scripts/export-products.mjs > /tmp/produkty.csv
```

i wklejenie zawartości do tego arkusza. Skrypt czyta publiczne Store API,
więc niczego nie zmienia.

## Kolumny

| Kolumna | Wymagana | Uwagi |
| --- | --- | --- |
| SKU | tak | Klucz. Po nim rozpoznajemy produkt przy aktualizacji. |
| Nazwa | przy dodawaniu | Tak, jak ma się wyświetlać w sklepie. |
| Kod EAN | nie | 13 cyfr. Trafia do metadanych produktu (`ean`) i do feedu Google jako `g:gtin`. |
| Cena brutto | przy dodawaniu | Złote z przecinkiem, np. `1299,00`. Bez „zł”. |
| Dostępność | nie | Lista: `od-reki`, `2-3-dni`, `7-10-dni`, `14-dni`, `na-zamowienie`, `niedostepny`. |
| Sztuki | nie | Liczba na stanie. |
| Kategoria | nie | Nazwa kategorii ze sklepu. |
| Marka | nie | Suzuki, Mercury, Garmin, Torqeedo… |
| Opis | nie | Puste przy aktualizacji = zostawiamy obecny. |
| Zdjęcia | nie | Adresy URL po przecinku; pierwszy jest główny. |
| Pasuje do | nie | SKU po przecinku → panel „Pasuje do” na stronie produktu. |
| Akcja | nie | `dodaj` / `aktualizuj` / `wylacz`. Puste = aktualizuj, a jak nie ma — dodaj. |

Puste pole przy aktualizacji znaczy „zostaw jak było”. Żeby wyczyścić
wartość, wpisuje się słowo `USUŃ`.

## Czego formatka nie zawiera

- **Ceny netto** — przeliczamy z brutto (VAT 23%).
- **Terminu wysyłki** — liczy go sklep z dostępności, z pominięciem weekendów
  i polskich świąt (`src/lib/delivery.ts`).
- **Uchwytu produktu** — tworzymy z nazwy.

## EAN a Google

Produkty bez EAN-u idą do Merchant Center z `identifier_exists: no` — Google
je przyjmuje, ale oferty z prawdziwym kodem mają wyraźnie lepszą widoczność
w Zakupach Google. Dlatego kolumna EAN jest w formatce od początku.
