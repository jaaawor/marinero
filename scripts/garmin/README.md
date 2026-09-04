# Nowości Garmin / JL Audio — wrzesień 2026

Dwa kroki: najpierw ze strony producenta, potem do naszego sklepu.

```
node scripts/garmin/pobierz.mjs --zapisz     # garmin.com/pl-PL → produkty.json
node scripts/garmin/import.mjs               # podgląd, niczego nie zapisuje
node scripts/garmin/import.mjs --zapisz      # 19 szkiców w Medusie (na VPS-ie)
node scripts/news/garmin-wrzesien-2026.mjs --zapisz   # aktualność ze zdjęciami
```

`pobierz.mjs` chodzi bez żadnego klucza — dane są publiczne. `import.mjs`
z `--zapisz` potrzebuje `MEDUSA_ADMIN_TOKEN`, a skrypt aktualności
`DIRECTUS_ADMIN_TOKEN`; oba siedzą w `.env.local` na VPS-ie i nie wchodzą do
repozytorium, więc zapis robi się na serwerze.

## Co się gdzie kryje

- **Cena stoi w osobnym obiekcie niż nazwa.** Strona produktowa Garmina trzyma
  mapę wariantów po numerze katalogowym (`"010-xxxxx-xx": {"productId", "productName",
  "productVariation"}`) i osobno blok cen, w którym `partNumber` stoi **za**
  `listPrice`. Parowanie „najbliższy numer przed ceną" przesuwa całą listę
  o jedną pozycję — sprawdzone, wychodziły ceny z sąsiedniego wariantu.
- **Nazwa wariantu bywa z przecinkiem** („6,5″ z maskownicą White Sport”), więc
  wzorzec kończy się na cudzysłowie, nie na przecinku. Inaczej z 6,5″ zostaje 6.
- **Adresu zdjęcia nie da się zgadnąć.** Kusi
  `res.garmin.com/pl_PL/products/<SKU>/v/cf-lg.jpg`, ale człon języka bywa inny
  (`en`) i zgadnięty adres wraca z **400** — z 19 wariantów trafiał jeden.
  Bierzemy adresy wypisane wprost w kodzie strony.

## Co powstaje w sklepie

19 produktów, każdy jako **szkic** — nie widać ich w sklepie, w wyszukiwarce
ani w feedzie do Google, więc katalog można obejrzeć na spokojnie. Publikacja
to `/narzedzia-8f3a/ceny` → filtr „Szkice” → Publikacja = opublikowany.

Każdy dostaje: cenę brutto w złotych z cennika producenta (i tę samą kwotę
jako `cena_detaliczna`, **bez** przekreślenia — przekreślona kwota równa
bieżącej wygląda jak pomyłka), numer katalogowy w SKU, zdjęcie, dział
Elektronika → Garmin, dostępność „na zamówienie” i notatkę z datą cennika.

Skrypt jest idempotentny: produkt o tym samym uchwycie albo SKU pomija, więc
powtórzenie przebiegu niczego nie zdubluje.
