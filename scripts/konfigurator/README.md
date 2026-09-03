# Bramka kontaktowa w konfiguratorze

Przy wybranych łodziach konfigurator otwiera się dopiero po podaniu **imienia
i adresu e-mail**. Włączone przy Aquilach: przy łodzi za kilkaset tysięcy
dolarów kalkulator jest narzędziem handlowym, a nie treścią do przeglądania —
kto go wypełnia, ten kupuje w tym albo w następnym sezonie. Przy drobnicy taka
bramka byłaby samą przeszkodą, dlatego to **przełącznik przy konkretnej łodzi**
(`configurators.wymaga_kontaktu`), a nie reguła na markę wpisana w kod: klient
włącza i wyłącza ją w panelu, bez wdrożenia.

## Włączenie (raz, na VPS-ie)

```bash
cd /opt/marinero-frontend
node scripts/konfigurator/bramka-directus.mjs            # pokazuje, co zrobi
node scripts/konfigurator/bramka-directus.mjs --zapisz   # zapisuje
```

Skrypt zakłada pole `configurators.wymaga_kontaktu`, kolekcję
`configurator_leads` i włącza bramkę przy wszystkich Aquilach. Jest
**idempotentny** — to, co już istnieje, zostawia w spokoju, więc można go
puścić drugi raz bez konsekwencji.

Bramka pojawi się na stronie po najbliższym odświeżeniu ISR, czyli do pięciu
minut.

## Jak to działa

- **Dane konfiguratora nie idą w HTML-u strony.** Przy łodzi z bramką strona
  modelu w ogóle ich nie dostaje; przeglądarka pobiera je z
  `/api/konfigurator/dane` dopiero po odblokowaniu. Gdyby opcje i ceny szły
  w propsach, wystarczyłoby zajrzeć w źródło — i została by dekoracja, która
  nikogo nie zatrzymuje, a wszystkich drażni.
- **Bilet jest podpisany po stronie serwera** (HMAC, `konfigurator-dostep.ts`),
  siedzi w ciasteczku `httpOnly` `marinero_konfigurator` i **żyje rok**. Kto
  raz zostawił kontakt, wraca prosto do kalkulatora: człowiek dobierający łódź
  wraca tygodniami, a formularz przy każdym wejściu czytałby się jak zarzut,
  że poprzedni raz się nie liczył.
- **O dostęp pytamy z przeglądarki**, nie w komponencie serwerowym. Sięgnięcie
  po ciasteczko przy renderze wyłączyłoby ISR na wszystkich 79 stronach łodzi.
- **Bez `DIRECTUS_ADMIN_TOKEN` bramki nie ma** — kontakt nie miałby gdzie
  wylądować, więc formularz zbierałby adresy donikąd. Konfigurator jest wtedy
  otwarty, tak jak przy pozostałych markach.

## Co widać w panelu

**Directus → Configurator leads**: imię, e-mail, ile razy otwierał, przy której
łodzi ostatnio i kiedy. Jedna osoba to jeden wiersz — sklejamy **po adresie**,
więc ten sam człowiek z telefonu i z biura nie robi się dwiema osobami.

Wejścia liczy `/api/konfigurator/dane`, bo przez nie przechodzi **każde**
otwarcie kalkulatora, także to z gotowym ciasteczkiem. Licznik przy zapisie
kontaktu rósłby tylko przy pierwszym razie i pokazywałby przy wszystkich
jedynkę.

**Co klika** — to widać tam, gdzie dotąd: `configurator_sessions` i zakładka
Statystyki w panelu. Sesja z łodzi za bramką ma teraz **wypełnione imię
i e-mail z biletu**, więc nie jest już anonimowa do momentu wysłania oferty.
Wpisane ręcznie dane wygrywają z biletem: ktoś mógł podać firmowy adres przy
bramce, a prywatny przy ofercie.

## Czego to nie robi

Nie jest to zabezpieczenie treści, tylko próg. Kto poda dowolny adres
e-mail, ten wejdzie — i tak ma być: pytamy o kontakt, a nie o dowód. Wartość
jest w tym, że **wiadomo, kto wraca**, a nie w tym, że ktoś nie zobaczy cen.
