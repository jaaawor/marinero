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
if ! sudo -u marinero -H bash -lc "cd $KATALOG && npm install --no-audit --no-fund && NEXT_TELEMETRY_DISABLED=1 NEXT_DIST_DIR=.next-build npm run build"; then
  echo "BŁĄD: build się nie udał — strona działa dalej na poprzedniej wersji"
  # Repozytorium zostaje na nowym commicie celowo: gdyby wróciło na stary,
  # cron próbowałby tego samego zepsutego wdrożenia co 5 minut w kółko.
  rm -rf .next-build
  exit 1
fi

# --- Podmiana ----------------------------------------------------------------
# Jedyny moment, w którym strona nie odpowiada — dwa `mv` i restart, kilka sekund
# zamiast kilku minut.
systemctl stop marinero-frontend.service || true
rm -rf .next.old
# Pełne `if`, nie `[ … ] && …`: przy `set -e` nieudany test (brak `.next`
# przy pierwszym wdrożeniu) przerwałby skrypt tuż po zatrzymaniu usługi
# i zostawił stronę wyłączoną.
if [ -d .next ]; then
  mv .next .next.old
fi
mv .next-build .next
chown -R marinero:marinero "$KATALOG"
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
  chown -R marinero:marinero "$KATALOG"
  systemctl start marinero-frontend.service
  exit 1
fi

echo "Wdrożone: $BRANCH @ ${ZDALNY:0:8}"
