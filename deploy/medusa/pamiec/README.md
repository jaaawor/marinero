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

### 1 i 2. Jedną komendą: `wlacz.py`

```bash
mkdir -p /var/www/commerce-robots
cp /opt/marinero-frontend/deploy/medusa/pamiec/robots.txt /var/www/commerce-robots/
python3 /opt/marinero-frontend/deploy/medusa/pamiec/wlacz.py
```

Skrypt sam znajduje katalog `static` Medusy, sam znajduje właściwy blok
`server` w konfiguracji nginxa (ten z `proxy_pass`, nie ten z samym
przekierowaniem), dopisuje w nim **jedną linijkę** `include` na poziomie
`server` i przeładowuje nginxa. `--sprawdz` pokazuje, co by zrobił, i niczego
nie zapisuje.

**Przed zmianą robi kopię pliku, a gdy `nginx -t` nie przejdzie — przywraca ją.**
To jest warunek, na jakim wolno ruszać konfigurację działającego serwera:
pomyłka ma kosztować dziesięć sekund, a nie leżącą stronę.

Co z tego wynika:

- **pliki statyczne oddaje nginx**, wprost z dysku, z `expires 30d` — to zabiera
  z Node'a większość ruchu widocznego w logu i sprawia, że ten sam robot nie
  pobiera tego samego zdjęcia w kółko;
- **API hosta Medusy jest zamknięte** dla robotów. `/store/` i `/admin/` nie są
  treścią do zaindeksowania. **`/static/` zostaje otwarte** — stamtąd Google
  Merchant Center pobiera zdjęcia ofert.

`nginx-static.conf` obok zostaje jako **czytelny wzorzec** tego, co skrypt
wpisuje; do ręcznego przegrywania nie jest potrzebny.

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

## Po poprawce: jeden pad na dobę, nie cztery na półtorej godziny

3 września proces przeżył **18,5 godziny** i dobił do 2,75 GB przy limicie
3 GB. Zdjęcia już przez niego nie idą (nginx oddaje `/static/` z dysku), więc
to, co zostało, to **powolny wyciek w samej Medusie** — rośnie równo, bez
związku z ruchem. Nie naprawimy go z tego repozytorium; da się wybrać moment,
w którym proces wstaje od nowa. Opis i włączenie: `nocny-restart.md`.
