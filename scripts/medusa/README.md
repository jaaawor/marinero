# Skrypty do Medusy

Narzędzia, które zapisują coś w sklepie. Wszystkie wymagają klucza
administratora `sk_…` — a ten jest sekretem i siedzi w `.env.local`
**na VPS-ie**, nie w repozytorium. Uruchamia się je więc na serwerze:

```bash
cd /opt/marinero-frontend
MEDUSA_ADMIN_TOKEN=$(grep '^MEDUSA_ADMIN_TOKEN=' .env.local | cut -d= -f2-) \
  node scripts/medusa/<skrypt>.mjs           # przebieg na sucho
MEDUSA_ADMIN_TOKEN=... node scripts/medusa/<skrypt>.mjs --zapis
```

Medusa 2 uwierzytelnia klucz `sk_…` przez **HTTP Basic** (klucz jako login,
puste hasło). Nagłówek `x-medusa-access-token` z Medusy 1 zwraca 401.

## `zestawy-instalacyjne.mjs`

Zakłada trzy zestawy instalacyjne elektryczne Suzuki, których po migracji
z WooCommerce zabrakło. Na starym sklepie nie były osobnymi produktami, tylko
polem dodatkowym doklejanym do ceny silnika (wtyczka „product fields"), więc
import ich nie przeniósł.

| zestaw | cena |
| --- | --- |
| Manetka topowa SPC keyless | 7 700 zł |
| Manetka boczna SPC keyless | 10 050 zł |
| Instalacja dwusilnikowa SPC keyless | 14 350 zł |

Ceny brutto, wprost ze starego sklepu. **Medusa 2 trzyma kwoty w jednostce
głównej**, więc w skrypcie stoi `7700`, a nie `770000`.

Zestaw pojawia się na stronie silnika przez metadaną `pasuje_do` (uchwyty
silników po przecinku) — ten sam mechanizm, który czyta
`src/lib/engine-addons.ts`. Lista silników jest przepisana z podpowiedzi
starego sklepu: **115BG / 140BBG / 150AP / 175AP / 200AP / 250AP / 300AP**,
czyli same duże, sterowane elektronicznie. Przy DF 20 czy DF 350 ATX zestaw
się nie pokaże — tam nie było go też wcześniej.

Dopasowanie idzie **po tytule produktu, nie po uchwycie**: po imporcie
z WooCommerce uchwyty bywają rozjechane z nazwą (`suzuki-df-150-apx-czarny`
to w katalogu „Suzuki DF 150 APL Biały").

Skrypt jest bezpieczny do powtórzenia: jeśli produkt o danym uchwycie już
istnieje, tylko odświeża `pasuje_do` zamiast zakładać drugi. Listę silników
można podejrzeć **bez klucza** — dopasowanie liczy się z publicznego Store API:

```bash
node scripts/medusa/zestawy-instalacyjne.mjs
```
