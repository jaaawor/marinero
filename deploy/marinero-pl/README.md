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

Strefę edytuje się w **DirectAdminie na starym hostingu** (tam stoją serwery
nazw `ns1/ns2.datanet.pl`): *Account Manager → DNS Management*.

```
marinero.pl.         A   192.109.241.27      (było 168.119.74.72)
www.marinero.pl.     A   192.109.241.27      (było 168.119.74.72)
sklep.marinero.pl.   A   192.109.241.27      (było 168.119.74.72)
```

Jeśli domena ma rekordy `AAAA` (IPv6) dla strony — trzeba je **usunąć albo
przestawić** na adres IPv6 nowego serwera. Zostawiony `AAAA` wskazujący na stary
serwer sprawi, że część ruchu dalej trafi na WordPressa.

## Kolejność

### 1. TTL — tylko w jednym miejscu

TTL jest **własnością rekordu w strefie DNS**, a nie ustawieniem serwera.
Strefa `marinero.pl` jest obsługiwana przez `ns1/ns2.datanet.pl` i edytuje się
ją w DirectAdminie na starym hostingu — czyli tam, gdzie już zostało zrobione.
**Na nowym serwerze nie ma czego ustawiać**: 192.109.241.27 nie serwuje DNS-u
dla tej domeny, tylko odbiera ruch HTTP.

### 2. Nginx (jeszcze po HTTP)

```bash
cd /opt/marinero-frontend && git pull
cp deploy/marinero-pl/nginx-marinero-pl.conf /etc/nginx/sites-available/marinero.pl
ln -sf ../sites-available/marinero.pl /etc/nginx/sites-enabled/marinero.pl
nginx -t && systemctl reload nginx
```

Plik celowo nie ma bloków TLS. Certyfikatu jeszcze nie ma, a wpisana ścieżka do
nieistniejącego pliku wywala `nginx -t` i nie da się przeładować konfiguracji.
Bloki HTTPS dopisze certbot w punkcie 4.

Sprawdzenie bez zmiany DNS-u (udajemy, że domena już tu wskazuje):

```bash
curl -sI --resolve marinero.pl:80:192.109.241.27 http://marinero.pl/ | head -3
curl -s  --resolve marinero.pl:80:192.109.241.27 http://marinero.pl/lodzie | grep -o "<title>[^<]*"
```

### 3. Adres kanoniczny w aplikacji

W `/opt/marinero-frontend/.env.local`:

```
NEXT_PUBLIC_SITE_URL=https://marinero.pl
```

i **przebudowa**, nie sam restart — część stron jest prerenderowana, a z tego
adresu biorą się `canonical`, `hreflang`, `sitemap.xml` i `robots.txt`:

```bash
bash /root/marinero-deploy.sh --force
```

### 4. Przełączenie DNS

W DirectAdminie zmienić trzy rekordy `A` z punktu „Co zmieniamy". Nic więcej.

Po kilku minutach (TTL 300 s):

```bash
dig +short A marinero.pl                 # ma być 192.109.241.27
dig +short A sklep.marinero.pl           # ma być 192.109.241.27
dig +short MX marinero.pl                # ma być 10 mail.marinero.pl  ← bez zmian
curl -sI http://marinero.pl/ | head -3   # 200, na razie po HTTP
```

Od tej chwili do punktu 5 strona chodzi **po HTTP**, bez kłódki. Żadna z tych
domen nie wysyła nagłówka `Strict-Transport-Security`, więc przeglądarki nie
odmówią połączenia — po prostu nie pokażą kłódki przez te kilka minut.

### 5. Certyfikat — dopiero teraz

Certyfikat wystawiamy **po** przełączeniu DNS-u, bo dopiero wtedy Let's Encrypt
trafia zapytaniem na właściwy serwer. Na 192.109.241.27:

```bash
certbot --nginx -d marinero.pl -d www.marinero.pl -d sklep.marinero.pl
```

Certbot sam sprawdzi domeny przez port 80, dopisze bloki HTTPS do
`/etc/nginx/sites-available/marinero.pl`, doda przekierowanie z HTTP na HTTPS
(wybrać opcję „Redirect") i ustawi odnawianie co 60 dni. Nic nie trzeba nigdzie
wklejać ręcznie.

Sprawdzenie:

```bash
curl -sI https://marinero.pl/ | head -3
curl -sI https://marinero.pl/lodzie/nordkapp/nordkapp-airborne-6-3 | head -3   # 301 na /modele/…
curl -sI https://sklep.marinero.pl/produkt/czesci-serwisowe/anody/anoda-aluminiowa-df2-5-350a | head -3
#   ↑ 301 na https://marinero.pl/sklep/produkt/anoda-aluminiowa-df2-5-350a
certbot renew --dry-run
```

Po tym kroku plik konfiguracji nginx różni się od tego w repozytorium — to
normalne, certbot dopisuje do niego ścieżki certyfikatu. Przy kolejnej zmianie
konfiguracji trzeba te bloki zachować albo puścić certbota jeszcze raz.

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

Wystarczy przywrócić trzy rekordy `A` na `168.119.74.72` w DirectAdminie. Przy
TTL 300 s wraca w kilka minut, bo stary serwer — z WordPressem i pocztą — przez
cały czas stoi nietknięty.

Jeśli odwrót nastąpi już po wystawieniu certyfikatu, nic nie trzeba sprzątać:
certyfikat na nowym serwerze po prostu leży nieużywany.

## Adresy ze starej strony

`src/lib/stare-adresy.ts` — 246 przekierowań 301 ze starego układu adresów
(`/lodzie/<marka>/<model>`, `/gielda/nowe/…`, `/targi/…`) na nowy. Wpięte
w `next.config.ts`, działają od razu po przełączeniu domeny.

Po przełączeniu warto w Google Search Console dodać własność `marinero.pl`
(jeśli jej nie ma) i wysłać `https://marinero.pl/sitemap.xml`.

## Stary sklep

`sklep.marinero.pl` idzie **razem z domeną główną**. Subdomena zostaje przy
życiu wyłącznie po to, żeby przekierować ruch: 371 z 388 produktów ma w Medusie
ten sam uchwyt co w WooCommerce, więc każdy trafia na swoją kartę
(`src/lib/stary-sklep.ts`), a reszta — koszyk, konto, towary zdjęte ze
sprzedaży — na `/sklep`.

Po przełączeniu stary WooCommerce przestaje być widoczny w sieci, ale **zostaje
zainstalowany na starym serwerze**. Nie kasować, dopóki nowy sklep nie odbierze
kilku zamówień.

## Do decyzji osobno

- **`marinero.150197.pl`** — po przełączeniu zostaje jako adres roboczy albo
  dostaje przekierowanie na `marinero.pl`. Uwaga: `dms.` i `commerce.` na tej
  domenie **muszą zostać**, bo z nich korzysta strona i panel.
