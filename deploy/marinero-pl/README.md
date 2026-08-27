# Przeniesienie strony na marinero.pl

Cel: pod `https://marinero.pl` ma stać ten serwis, a **poczta i wszystko inne
na starym serwerze ma działać jak dotąd**.

## Co gdzie stoi (stan na dziś)

| co | adres | serwer |
| --- | --- | --- |
| stara strona (WordPress + LiteSpeed) | `marinero.pl`, `www`, `sklep.marinero.pl` | **168.119.74.72** |
| **poczta** (`MX → mail.marinero.pl`) | `mail.marinero.pl` | **168.119.74.72** |
| nowy serwis (Next.js) | `marinero.150197.pl` | **192.109.241.27** |
| Directus, Medusa, Chatwoot, Postgres | `dms.` / `commerce.` | **192.109.241.27** |
| DNS | strefa `marinero.pl` | ns1/ns2.datanet.pl |

**Poczta siedzi na tym samym serwerze co stara strona.** Dlatego przenosimy
domenę, a nie serwer: zmieniamy tylko rekordy `A` strony, a wszystko pocztowe
zostawiamy nietknięte.

Aplikacji nie da się przenieść na serwer 168.119.74.72 — to hosting LiteSpeed
pod WordPressa, bez Node'a i bez roota, a cały backend (Directus, Medusa,
Chatwoot, Postgres w Dockerze) stoi na 192.109.241.27. Rozdzielenie frontu od
backendu nic by nie dało poza dwoma serwerami do pilnowania.

## Czego NIE ruszamy w DNS

Te rekordy zostają dokładnie takie, jakie są — każdy z nich obsługuje pocztę:

```
marinero.pl.          MX    10 mail.marinero.pl.
mail.marinero.pl.     A     168.119.74.72
marinero.pl.          TXT   "v=spf1 a mx ip4:168.119.74.72 ip6:… ~all"
*._domainkey          TXT   (DKIM)
_dmarc                TXT   (DMARC)
autodiscover / autoconfig / _imaps / _submission  (jeśli są)
```

Uwaga do SPF: jest w nim mechanizm `a`, czyli „adres A domeny". Po przełączeniu
zacznie on wskazywać nowy serwer WWW — to **nie odbiera** uprawnień serwerowi
pocztowemu, bo ten jest wymieniony osobno przez `mx` i `ip4:168.119.74.72`.
SPF-a **nie trzeba i nie należy przy okazji poprawiać**; jedna zmiana naraz.

## Co zmieniamy w DNS

```
marinero.pl.       A   192.109.241.27      (było 168.119.74.72)
www.marinero.pl.   A   192.109.241.27      (było 168.119.74.72)
```

Jeśli domena ma rekordy `AAAA` (IPv6) dla strony — trzeba je **usunąć albo
przestawić** na adres IPv6 nowego serwera. Zostawiony `AAAA` wskazujący na stary
serwer sprawi, że część ruchu dalej trafi na WordPressa.

## Kolejność

### 1. Dzień wcześniej: skrócić TTL

W panelu DNS ustawić TTL rekordów `A` dla `marinero.pl` i `www` na **300 s**.
Dzięki temu ewentualny odwrót zadziała w kilka minut, a nie w dobę.

### 2. Certyfikat — jeszcze przed przełączeniem

Certyfikat trzeba wystawić, **zanim** DNS wskaże nowy serwer, inaczej między
przełączeniem a wystawieniem certyfikatu strona wita ostrzeżeniem przeglądarki.

Na VPS-ie aplikacji (192.109.241.27):

```bash
mkdir -p /var/www/certbot
certbot certonly --manual --preferred-challenges http \
  -d marinero.pl -d www.marinero.pl
```

Certbot poda plik do wystawienia pod adresem
`http://marinero.pl/.well-known/acme-challenge/<token>`. Ten plik wgrywamy
**na stary serwer** (do katalogu strony, np. `public_html/.well-known/
acme-challenge/`) — stary WordPress dalej odpowiada na tę domenę, więc
weryfikacja przejdzie. Po wystawieniu certyfikatu plik można skasować.

### 3. Nginx na VPS-ie aplikacji

```bash
cp deploy/marinero-pl/nginx-marinero-pl.conf /etc/nginx/sites-available/marinero.pl
ln -sf ../sites-available/marinero.pl /etc/nginx/sites-enabled/marinero.pl
nginx -t && systemctl reload nginx
```

Sprawdzenie bez zmiany DNS-u (udajemy, że domena już tu wskazuje):

```bash
curl -sI --resolve marinero.pl:443:192.109.241.27 https://marinero.pl/ | head -3
curl -s  --resolve marinero.pl:443:192.109.241.27 https://marinero.pl/lodzie | grep -o "<title>[^<]*"
```

### 4. Adres kanoniczny w aplikacji

W `/opt/marinero-frontend/.env.local`:

```
NEXT_PUBLIC_SITE_URL=https://marinero.pl
```

i **przebudowa**, nie sam restart — część stron jest prerenderowana, a z tego
adresu biorą się `canonical`, `hreflang`, `sitemap.xml` i `robots.txt`:

```bash
bash /root/marinero-deploy.sh --force
```

### 5. Przełączenie DNS

W panelu datanet.pl zmienić dwa rekordy `A` z punktu „Co zmieniamy". Nic więcej.

Po kilku minutach:

```bash
dig +short A marinero.pl                 # ma być 192.109.241.27
dig +short MX marinero.pl                # ma być 10 mail.marinero.pl  ← bez zmian
curl -sI https://marinero.pl/ | head -3
curl -sI https://marinero.pl/lodzie/nordkapp/nordkapp-airborne-6-3 | head -3   # 301 na /modele/…
```

### 6. Poczta — sprawdzić od razu po przełączeniu

```bash
dig +short MX marinero.pl
dig +short A mail.marinero.pl            # nadal 168.119.74.72
```

I praktycznie: wysłać maila **na** `biuro@marinero.pl` z zewnętrznej skrzynki
oraz **z** tej skrzynki na zewnątrz. Klienty pocztowe łączą się z
`mail.marinero.pl`, więc nie wymagają przekonfigurowania.

### 7. Stary serwer

Zostaje włączony i nietknięty — WordPress, poczta, konta FTP. Po przełączeniu
DNS-u nikt nie trafi na starą stronę przez domenę, ale zostaje ona dostępna dla
nas (przez adres IP albo tymczasową subdomenę) jako źródło treści i jako plan
odwrotu. **Nie kasować przez co najmniej miesiąc.**

## Odwrót

Wystarczy przywrócić dwa rekordy `A` na `168.119.74.72`. Przy TTL 300 s wraca
w kilka minut, bo stary serwer przez cały czas stoi nietknięty.

## Adresy ze starej strony

`src/lib/stare-adresy.ts` — 246 przekierowań 301 ze starego układu adresów
(`/lodzie/<marka>/<model>`, `/gielda/nowe/…`, `/targi/…`) na nowy. Wpięte
w `next.config.ts`, działają od razu po przełączeniu domeny.

Po przełączeniu warto w Google Search Console dodać własność `marinero.pl`
(jeśli jej nie ma) i wysłać `https://marinero.pl/sitemap.xml`.

## Do decyzji osobno

- **`sklep.marinero.pl`** — stary sklep WooCommerce, wciąż na starym serwerze.
  Docelowo przekierowanie na `https://marinero.pl/sklep`. To osobna zmiana
  (rekord `A` tej subdomeny + wpis w nginx) i nie musi iść razem z domeną główną.
- **`marinero.150197.pl`** — po przełączeniu zostaje jako adres roboczy albo
  dostaje przekierowanie na `marinero.pl`. Uwaga: `dms.` i `commerce.` na tej
  domenie **muszą zostać**, bo z nich korzysta strona i panel.
