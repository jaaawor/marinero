#!/usr/bin/env python3
"""
Włącza wydawanie zdjęć Medusy przez nginxa — bez ręcznego grzebania w konfiguracji.

    python3 /opt/marinero-frontend/deploy/medusa/pamiec/wlacz.py

Co robi, po kolei:

 1. znajduje katalog `static` Medusy (tam leżą zdjęcia produktów);
 2. zapisuje `/etc/nginx/snippets/marinero-commerce-static.conf` z tą ścieżką;
 3. znajduje blok `server` obsługujący hosta Medusy i dopisuje w nim JEDNĄ
    linijkę `include …`, na poziomie `server` — nazwana lokalizacja
    `@medusa` nie działa nigdzie indziej;
 4. sprawdza `nginx -t` i przeładowuje.

**Przed każdą zmianą robi kopię pliku**, a gdy `nginx -t` nie przejdzie —
przywraca ją i nic nie zostaje przestawione. To jest warunek, na jakim wolno
ruszać konfigurację działającego serwera: pomyłka ma kosztować dziesięć sekund,
a nie leżącą stronę.

`--sprawdz` pokazuje, co by zrobił, i niczego nie zapisuje.
"""

import os
import re
import shutil
import subprocess
import sys
import time

HOST = "commerce.marinero.150197.pl"
SNIPPET = "/etc/nginx/snippets/marinero-commerce-static.conf"
WLACZENIE = "include snippets/marinero-commerce-static.conf;"
ROBOTS_KATALOG = "/var/www/commerce-robots"

TYLKO_PODGLAD = "--sprawdz" in sys.argv


def powiedz(tekst=""):
    print(tekst, flush=True)


def znajdz_static():
    """
    Katalog ze zdjęciami. Medusa trzyma go pod `.medusa/server/static` albo
    wprost w katalogu backendu — zależnie od wersji i od tego, czy build stoi
    obok źródeł. Szukamy głęboko, bo pierwsze podejście z `-maxdepth 5` nie
    sięgało wystarczająco daleko.
    """
    kandydaci = []
    for korzen, katalogi, _ in os.walk("/opt/marinero-commerce"):
        katalogi[:] = [k for k in katalogi if k != "node_modules"]
        if korzen.count(os.sep) > 12:
            katalogi[:] = []
            continue
        for k in list(katalogi):
            if k == "static":
                kandydaci.append(os.path.join(korzen, k))

    if not kandydaci:
        return ""

    # Ten, w którym naprawdę leżą pliki — pusty katalog `static` bywa w kilku
    # miejscach po buildzie, a interesuje nas ten z zawartością.
    kandydaci.sort(key=lambda sciezka: len(os.listdir(sciezka)), reverse=True)
    return kandydaci[0]


def pliki_nginx():
    katalogi = ["/etc/nginx/sites-enabled", "/etc/nginx/conf.d"]
    znalezione = []
    for katalog in katalogi:
        if not os.path.isdir(katalog):
            continue
        for nazwa in sorted(os.listdir(katalog)):
            sciezka = os.path.realpath(os.path.join(katalog, nazwa))
            if os.path.isfile(sciezka) and sciezka not in znalezione:
                znalezione.append(sciezka)
    return znalezione


def bloki_server(tresc):
    """
    Bloki `server { … }` z pliku, jako (początek, koniec) w znakach.
    Liczymy klamry ręcznie — nginx nie ma parsera w bibliotece standardowej,
    a wyrażenie regularne nie poradzi sobie z zagnieżdżonymi `location`.
    """
    out = []
    for dopasowanie in re.finditer(r"\bserver\s*\{", tresc):
        poziom = 0
        i = dopasowanie.end() - 1
        while i < len(tresc):
            if tresc[i] == "{":
                poziom += 1
            elif tresc[i] == "}":
                poziom -= 1
                if poziom == 0:
                    out.append((dopasowanie.start(), i + 1))
                    break
            i += 1
    return out


def wlasciwy_blok():
    """
    Blok, który naprawdę obsługuje ruch: ma nazwę hosta Medusy **i** przekazuje
    dalej do aplikacji. Bloki z samym `return 301` odpadają — dopisanie tam
    czegokolwiek nie zmieniłoby niczego.
    """
    for sciezka in pliki_nginx():
        with open(sciezka, encoding="utf-8", errors="replace") as plik:
            tresc = plik.read()
        for start, koniec in bloki_server(tresc):
            blok = tresc[start:koniec]
            if HOST not in blok:
                continue
            if "proxy_pass" not in blok:
                continue
            return sciezka, tresc, start, koniec, blok
    return None


def main():
    powiedz("== Zdjęcia Medusy przez nginxa ==")
    powiedz()

    katalog = znajdz_static()
    if not katalog:
        powiedz("BŁĄD: nie znalazłem katalogu `static` pod /opt/marinero-commerce.")
        powiedz("      Zdjęcia mogą iść z innego miejsca (np. z chmury). Wtedy ta")
        powiedz("      zmiana nie ma zastosowania — zostaje robots.txt i limit sterty.")
        return 1
    powiedz(f"Zdjęcia leżą w:  {katalog}  ({len(os.listdir(katalog))} plików)")

    znaleziony = wlasciwy_blok()
    if not znaleziony:
        powiedz(f"BŁĄD: nie znalazłem bloku `server` dla {HOST} z `proxy_pass`.")
        powiedz("      Sprawdź: grep -rl commerce /etc/nginx/sites-enabled/")
        return 1

    sciezka, tresc, start, koniec, blok = znaleziony
    powiedz(f"Blok nginxa:     {sciezka}")

    if WLACZENIE in blok:
        powiedz()
        powiedz("Włączenie już tam stoi — nie ruszam pliku, odświeżam sam snippet.")
        zmiana_pliku = False
    else:
        zmiana_pliku = True

    snippet = f"""# Zdjęcia produktów prosto z dysku, z pominięciem Node'a.
#
# Plik pisany przez `deploy/medusa/pamiec/wlacz.py` — poprawki rób tam, nie tu.
#
# Powód: robot Meta ciągnął `/static/…jpg` dziesiątkami na sekundę, a każdy plik
# szedł przez ten sam proces Node'a, który obsługuje Store API — i to on padał
# na limicie sterty V8. Wydawanie plików to jedyna rzecz, którą nginx robi
# lepiej od czegokolwiek innego.
location /static/ {{
    alias {katalog.rstrip("/")}/;

    expires 30d;
    add_header Cache-Control "public, max-age=2592000" always;
    access_log off;

    # Gdy pliku nie ma na dysku, pytamy Medusę. Lepiej wolno niż 404 na zdjęciu
    # produktu — w Merchant Center kończy się to odrzuceniem oferty.
    try_files $uri @medusa;
}}

location @medusa {{
    proxy_pass http://127.0.0.1:9000;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}}

# robots.txt dla hosta Medusy: API sklepu nie jest treścią do zaindeksowania.
# `/static/` **zostaje otwarte** — stamtąd Merchant Center pobiera zdjęcia ofert.
location = /robots.txt {{
    root {ROBOTS_KATALOG};
    try_files /robots.txt =404;
}}
"""

    if TYLKO_PODGLAD:
        powiedz()
        powiedz("--- podgląd, nic nie zapisuję ---")
        powiedz(snippet)
        powiedz(f"…oraz linijka `{WLACZENIE}` w bloku wyżej.")
        return 0

    # Snippet zapisujemy zawsze — jest nasz i nikt go ręcznie nie edytuje.
    os.makedirs(os.path.dirname(SNIPPET), exist_ok=True)
    with open(SNIPPET, "w", encoding="utf-8") as plik:
        plik.write(snippet)
    powiedz(f"Zapisany:        {SNIPPET}")

    kopia = ""
    if zmiana_pliku:
        kopia = f"{sciezka}.przed-static-{time.strftime('%Y%m%d-%H%M%S')}"
        shutil.copy2(sciezka, kopia)
        powiedz(f"Kopia pliku:     {kopia}")

        # Wstawiamy zaraz za `server_name` — to jest poziom `server`, czyli
        # jedyne miejsce, w którym nazwana lokalizacja `@medusa` jest legalna.
        nazwa = re.search(r"[^\n]*server_name[^\n]*;", blok)
        if not nazwa:
            powiedz("BŁĄD: nie znalazłem linijki `server_name` w tym bloku.")
            return 1

        gdzie = start + nazwa.end()
        nowa = tresc[:gdzie] + f"\n\n    {WLACZENIE}\n" + tresc[gdzie:]
        with open(sciezka, "w", encoding="utf-8") as plik:
            plik.write(nowa)
        powiedz(f"Dopisane:        {WLACZENIE}")

    test = subprocess.run(["nginx", "-t"], capture_output=True, text=True)
    if test.returncode != 0:
        powiedz()
        powiedz("nginx -t NIE PRZESZEDŁ — cofam zmianę:")
        powiedz(test.stderr.strip())
        if kopia:
            shutil.copy2(kopia, sciezka)
            powiedz(f"Przywrócone z:   {kopia}")
        return 1

    subprocess.run(["systemctl", "reload", "nginx"], check=False)
    powiedz()
    powiedz("Gotowe. nginx przeładowany.")
    powiedz()
    powiedz("Sprawdzenie za kilka minut — ma zejść do zera:")
    powiedz("  journalctl -u marinero-commerce --since \"5 min ago\" | grep -c '\"path\":\"/static/'")
    return 0


if __name__ == "__main__":
    sys.exit(main())
