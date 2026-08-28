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

## `porzadki-kategorii.mjs`

Kasuje trzy kategorie, które zostały po imporcie z WooCommerce i tylko
zaśmiecały nawigację:

| kategoria | dlaczego |
| --- | --- |
| `promocje-garmin` | worek na przecenione plotery — te same produkty leżą już w „GPSMAP" i „Echomap" |
| `suzuki-oleje` | druga „Suzuki" obok „Oleje Suzuki", z tymi samymi dwoma olejami ECSTAR |
| `lodzie-motorowe` | dwie łodzie Jeanneau w sklepie z częściami — łodzie sprzedajemy na `/gielda` |

Produkt, dla którego kasowana kategoria jest **jedyną**, nie zostaje bez
przydziału: łodzie idą do szkiców, a przy pozostałych kategoriach skrypt
w takiej sytuacji **nic nie kasuje** i wypisuje ostrzeżenie. Front pomija te
kategorie niezależnie od skryptu (`HIDDEN_SHOP_CATEGORIES` w
`src/lib/shop-taxonomy.ts`), więc kolejność wdrożenia nie ma znaczenia.

## `zdjecia-ze-starego-sklepu.mjs`

Migracja z WooCommerce przeniosła **adresy zdjęć, nie pliki**: wszystkie 907
zdjęć przy 387 produktach wisi na `sklep.marinero.pl`. Dopóki stary serwer
stoi, sklep wygląda dobrze — ale w dniu, w którym przepniemy tę subdomenę na
nowy serwer (a taki jest plan: przekierowanie na `marinero.pl/sklep`), każde
zdjęcie w sklepie zamieni się w przekierowanie do listy produktów.

```bash
cd /opt/marinero-frontend
TOKEN=$(grep -h '^MEDUSA_ADMIN_TOKEN=' .env.local | cut -d= -f2- | tr -d '"'"'\'')

# najpierw na sucho — ile produktów dotyczy
MEDUSA_ADMIN_TOKEN=$TOKEN node scripts/medusa/zdjecia-ze-starego-sklepu.mjs

# potem pięć na próbę i obejrzeć je w sklepie
MEDUSA_ADMIN_TOKEN=$TOKEN node scripts/medusa/zdjecia-ze-starego-sklepu.mjs --zapis --ile 5

# na koniec całość (kilkanaście minut)
MEDUSA_ADMIN_TOKEN=$TOKEN node scripts/medusa/zdjecia-ze-starego-sklepu.mjs --zapis
```

Skrypt jest wznawialny — produkt bez ani jednego zdjęcia na starym serwerze
jest pomijany, więc przerwany przebieg wystarczy puścić od nowa. Produkt
przepinamy **tylko w całości**: gdy choć jedno zdjęcie się nie pobrało,
zostaje po staremu. Podmiana połowy adresów zostawiłaby galerię rozjechaną
między dwa serwery, a po wyłączeniu starego — z dziurami w środku.

Nie ufamy nagłówkowi `Content-Type` ani rozmiarowi: stary sklep na część
adresów oddaje stronę HTML („trwają prace"), która waży 12 kB i podpisuje się
jako `image/jpeg`. Sprawdzamy **nagłówek pliku** — pierwsze bajty JPEG, PNG,
GIF albo WEBP.

**Przepięcie `sklep.marinero.pl` na nowy serwer wolno zrobić dopiero po tym
skrypcie.**

## `adresy-zdjec.mjs`

Lokalny magazyn plików Medusy skleja adres wgranego pliku ze swojego
`backend_url`, a ten domyślnie brzmi `http://localhost:9000`. Po migracji
zdjęć wszystkie 907 adresów wyglądało tak: pliki leżały dobrze i były
publicznie dostępne pod `https://commerce.…/static/…`, ale w bazie stał
adres, którego przeglądarka klienta nie ma jak otworzyć — **w sklepie nie
było widać ani jednego zdjęcia**.

```bash
cd /opt/marinero-frontend
TOKEN=$(grep -h '^MEDUSA_ADMIN_TOKEN=' .env.local | cut -d= -f2- | tr -d '"'"'\'')
MEDUSA_ADMIN_TOKEN=$TOKEN node scripts/medusa/adresy-zdjec.mjs            # na sucho
MEDUSA_ADMIN_TOKEN=$TOKEN node scripts/medusa/adresy-zdjec.mjs --zapis
```

Skrypt można puszczać wielokrotnie — produkt z poprawnymi adresami jest
pomijany. `zdjecia-ze-starego-sklepu.mjs` prostuje adres już przy wgrywaniu,
więc to jest naprawa po fakcie, nie stały element procesu.

Żeby kolejne wgrania (także te z panelu Medusy) od razu miały właściwy adres,
trzeba ustawić w konfiguracji Medusy `backend_url` magazynu plików na
`https://commerce.marinero.150197.pl` — inaczej każde nowe zdjęcie produktu
znowu wyląduje pod `localhost`.
