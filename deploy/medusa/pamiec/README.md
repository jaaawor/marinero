# Medusa padała co pół godziny

## Co się działo

`journalctl -u marinero-commerce` z 2 września:

```
17:39:55  FATAL ERROR: Ineffective mark-compacts near heap limit
          Allocation failed - JavaScript heap out of memory
17:40:06  Started marinero-commerce.service
18:02:03  FATAL ERROR: … JavaScript heap out of memory
18:02:14  Started marinero-commerce.service
18:23:19  FATAL ERROR: … JavaScript heap out of memory
19:02:04  FATAL ERROR: … JavaScript heap out of memory
```

Cztery pady w półtorej godziny, za każdym razem restart po dziesięciu sekundach.
Stąd brały się „momenty, że sklep się zacina", `502` na `/sklep` i puste bloki
marek na stronie głównej: przez te dziesięć sekund `connect() failed (111:
Connection refused)` do `127.0.0.1:9000`, a strona zapisana wtedy w cache'u ISR
stała potem bez połowy sekcji.

## Czego to NIE było

**Nie zabrakło pamięci w maszynie.** `grep -c "Out of memory" /var/log/kern.log`
dawało **zero**, a `free -h` pokazywał kilka wolnych gigabajtów. Zabójcą nie był
OOM killer jądra, tylko **własny limit sterty V8** — Node zabija się sam, gdy
odśmiecanie przestaje nadążać. `systemctl status` podawał szczyt 1,2 GB przy
domyślnym limicie w tych okolicach.

To ważne rozróżnienie, bo prowadzi w zupełnie inne miejsce: dokładanie RAM-u do
serwera niczego by nie zmieniło.

## Co ją zapychało

W logu Medusy prawie każdy wiersz wygląda tak:

```
GET /static/1787889114568-150.jpg  200  103278 B  duration 3.343
user_agent: … meta-externalagent/1.1 (+https://developers.facebook.com/…)
referrer: https://marinero.pl/
```

Robot Meta ciągnął zdjęcia produktów **dziesiątkami na sekundę**, z kilkunastu
adresów naraz (`57.141.20.*`). Każdy plik szedł przez proces Node'a — ten sam,
który obsługuje Store API. Do tego roboty chodziły po kombinacjach filtrów na
`marinero.pl`, a każde takie wejście to `GET /store/products?limit=100&offset=…`
z całym modułem wyceny. Razem: sterta rośnie szybciej, niż V8 zdąży ją sprzątać.

## Co z tym robimy — w kolejności ważności

### 1. Zdjąć Medusie wydawanie zdjęć (`nginx-static.conf`)

Pliki statyczne oddaje nginx, wprost z dysku, z `expires 30d`. To zabiera
z Node'a **większość ruchu**, jaki widać w logu, i przy okazji sprawia, że ten
sam robot nie pobiera tego samego zdjęcia w kółko.

Ścieżkę w `alias` trzeba najpierw potwierdzić:

```bash
find /opt/marinero-commerce -maxdepth 5 -type d -name static -not -path '*/node_modules/*'
```

### 2. Zamknąć API przed robotami (`robots.txt`)

`/store/` i `/admin/` nie są treścią do zaindeksowania. **`/static/` zostaje
otwarte** — stamtąd Google Merchant Center pobiera zdjęcia ofert.

### 3. Podnieść limit sterty (`marinero-commerce-pamiec.conf`)

`--max-old-space-size=3072` przy 8 GB w maszynie. To jest podpórka: oddala
moment przepełnienia, ale gdyby Medusa miała wyciek, i tak w końcu dojdzie do
limitu — tyle że rzadziej i bez rozbierania sklepu w środku dnia.

Przy okazji `Restart=always` w jawnej postaci: usługa wstawała sama, ale to
jedyna rzecz, dzięki której sklep wracał po dziesięciu sekundach, zamiast leżeć
do rana. Nie ma powodu, żeby zależało to od domysłu.

### 4. Po stronie strony (już zrobione)

- `robots.txt` na `marinero.pl` zamyka adresy z filtrami — to one kazały Medusie
  wydawać cały katalog przy każdym wejściu robota;
- Store API ma limit czasu 15 s i jedno ponowienie, więc pad Medusy nie wiesza
  już renderu na dwie minuty.

## Jak sprawdzić, czy pomogło

```bash
# Pady sterty — po zmianach lista ma przestać rosnąć
journalctl -u marinero-commerce --since today | grep -c "heap out of memory"

# Ile zdjęć idzie jeszcze przez Node'a (ma zejść do zera)
journalctl -u marinero-commerce --since "10 min ago" | grep -c '"path":"/static/'

# Bieżące zużycie
systemctl status marinero-commerce --no-pager | grep Memory
```
