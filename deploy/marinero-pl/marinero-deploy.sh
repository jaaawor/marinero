#!/usr/bin/env bash
#
# Wdrożenie marinero.pl — kopia wzorcowa. Na serwerze leży pod
# /root/marinero-deploy.sh i jest odpalana z crona co 5 minut:
#
#   */5 * * * * /root/marinero-deploy.sh >> /var/log/marinero-deploy.log 2>&1
#
# Ręczne wymuszenie (także bez nowych zmian):
#   bash /root/marinero-deploy.sh --force
#
# Po zmianie tego pliku w repozytorium trzeba go przegrać na serwer:
#   cp /opt/marinero-frontend/deploy/marinero-pl/marinero-deploy.sh /root/marinero-deploy.sh
#   chmod +x /root/marinero-deploy.sh
#
set -Eeuo pipefail

# --- Blokada -----------------------------------------------------------------
# Cron wraca co 5 minut, a build trwa dłużej. Zwykle ratuje nas porównanie
# commitów (drugi przebieg widzi, że nie ma nowych zmian), ale gdy w trakcie
# budowania wejdzie kolejny commit, drugi przebieg ruszy naprawdę — i zrobi
# `git reset --hard` pod działającym buildem. Blokada zamyka tę furtkę.
exec 9>/var/lock/marinero-deploy.lock
if ! flock -n 9; then
  echo "Wdrożenie już trwa — pomijam ten przebieg"
  exit 0
fi

BRANCH="${DEPLOY_BRANCH:-main}"
KATALOG=/opt/marinero-frontend
cd "$KATALOG"

git fetch origin "$BRANCH"
LOKALNY="$(git rev-parse HEAD)"
ZDALNY="$(git rev-parse "origin/$BRANCH")"

if [ "$LOKALNY" = "$ZDALNY" ] && [ "${1:-}" != "--force" ]; then
  echo "Brak nowych zmian ($BRANCH @ ${LOKALNY:0:8})"
  exit 0
fi

git reset --hard "origin/$BRANCH"
chown -R marinero:marinero "$KATALOG"

# --- Build przy działającej stronie ------------------------------------------
# Strona ma stać przez cały czas budowania. Wcześniej usługa była zatrzymywana
# PRZED buildem, więc marinero.pl leżało kilka minut przy każdym wdrożeniu —
# a gdy build się nie udał, `set -e` przerywał skrypt przed `systemctl start`
# i strona zostawała wyłączona na dobre. Dokładnie tak wyglądała awaria
# z 31 sierpnia: build nie dokończył się z braku pamięci i nikt strony nie wstał.
#
# Dlatego budujemy do OSOBNEGO katalogu i podmieniamy dopiero gotowy wynik.
# Budowanie wprost do `.next`, z którego serwer właśnie serwuje stronę, potrafi
# jej spod nóg wyjąć pliki, których przeglądarka klienta jeszcze nie pobrała.
rm -rf .next-build

# Cache przenosimy ze starego builda do nowego. Bez tego każde wdrożenie
# zaczyna od zera trzy różne rzeczy naraz: kompilator (`webpack`), wynik
# zapytań `fetch` do Directusa i Medusy (`fetch-cache`) oraz przeskalowane
# zdjęcia (`images`). Stąd brało się „po deployu strona strasznie długo się
# ładuje" — pierwszy człowiek, który wszedł, płacił za wszystkich: pełny render
# plus komplet zapytań do CMS-a, przy każdej podstronie osobno.
#
# Przenosimy **tylko te trzy katalogi**, nigdy całego `.next`. Gotowe strony
# ze starego builda zostają, gdzie były — po zmianie kodu trzeba je narysować
# od nowa, a podłożenie starego HTML-a pod nową wersję znaczyłoby, że wdrożenie
# niczego nie zmienia, dopóki coś tam nie wygaśnie.
if [ -d .next/cache ]; then
  mkdir -p .next-build/cache
  for c in webpack fetch-cache images; do
    [ -d ".next/cache/$c" ] && cp -a ".next/cache/$c" .next-build/cache/ || true
  done
  chown -R marinero:marinero .next-build
fi

if ! sudo -u marinero -H bash -lc "cd $KATALOG && npm install --no-audit --no-fund && NEXT_TELEMETRY_DISABLED=1 NEXT_DIST_DIR=.next-build npm run build"; then
  echo "BŁĄD: build się nie udał — strona działa dalej na poprzedniej wersji"
  # Repozytorium zostaje na nowym commicie celowo: gdyby wróciło na stary,
  # cron próbowałby tego samego zepsutego wdrożenia co 5 minut w kółko.
  rm -rf .next-build
  exit 1
fi

# --- Podmiana ----------------------------------------------------------------
# Jedyny moment, w którym strona nie odpowiada: dwa `mv` i start Nexta, czyli
# kilkanaście sekund zamiast kilku minut. Przez ten czas nginx nie ma z czym
# rozmawiać i oddaje „502 Bad Gateway" — dlatego w konfiguracji nginxa stoi
# `error_page` z ekranem przerwy, a panel przeczekuje 502 i pyta ponownie.
#
# W tym oknie nie robimy **niczego**, co da się zrobić wcześniej albo później.
# Stał tu kiedyś `chown -R` na całym katalogu: przy `node_modules` to dziesiątki
# tysięcy plików i kilka sekund przerwy **za nic**, bo build i tak powstaje jako
# użytkownik `marinero`, a `mv` zachowuje właściciela.
systemctl stop marinero-frontend.service || true
rm -rf .next.old
# Pełne `if`, nie `[ … ] && …`: przy `set -e` nieudany test (brak `.next`
# przy pierwszym wdrożeniu) przerwałby skrypt tuż po zatrzymaniu usługi
# i zostawił stronę wyłączoną.
if [ -d .next ]; then
  mv .next .next.old
fi
mv .next-build .next
systemctl start marinero-frontend.service

# --- Sprawdzenie -------------------------------------------------------------
sleep 8
BLEDY=0
for p in / /lodzie /modele/aquila-42-coupe /sklep; do
  kod="$(curl -sS -o /dev/null -m 30 -w "%{http_code}" "https://marinero.pl$p" || echo 000)"
  echo "$p HTTP $kod"
  [ "$kod" = "200" ] || BLEDY=$((BLEDY + 1))
done

if [ "$BLEDY" -gt 0 ]; then
  echo "BŁĄD: $BLEDY z 4 adresów nie odpowiada — wracam do poprzedniej wersji"
  systemctl stop marinero-frontend.service || true
  rm -rf .next
  mv .next.old .next
  systemctl start marinero-frontend.service
  exit 1
fi

# --- Rozgrzewka --------------------------------------------------------------
# Strona już działa, ale świeży proces nie ma w pamięci ani jednej narysowanej
# strony: pierwsze wejście na każdy adres to pełny render plus zapytania do
# Directusa i Medusy. Przy jednym procesie Node'a i kilkudziesięciu podstronach
# oznacza to, że przez pierwszą minutę po wdrożeniu każdy trafia na „ładuje
# się w nieskończoność" — bo akurat on renderuje.
#
# Dlatego pierwsze wejścia robimy sami, z mapy strony (czyli po tych adresach,
# które ludzie naprawdę odwiedzają). Budżet jest **twardy**: cron wraca co
# 5 minut, więc rozgrzewka nie może się rozlać na kolejny przebieg.
KONIEC=$(( $(date +%s) + 150 ))
ILE=0
for u in $(curl -sS -m 20 https://marinero.pl/sitemap.xml 2>/dev/null \
            | grep -o '<loc>[^<]*' | sed 's/^<loc>//' | head -40); do
  [ "$(date +%s)" -lt "$KONIEC" ] || break
  curl -sS -o /dev/null -m 20 "$u" >/dev/null 2>&1 || true
  ILE=$((ILE + 1))
done
echo "Rozgrzane adresy: $ILE"

echo "Wdrożone: $BRANCH @ ${ZDALNY:0:8}"
