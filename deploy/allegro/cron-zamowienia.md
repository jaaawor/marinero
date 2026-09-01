# Automatyczne pobieranie zamówień z Allegro

Panel czyta zamówienia **na żywo** przy każdym wejściu w zakładkę i tak
zostaje. Automat robi coś innego: co pół godziny zagląda do Allegro i zapisuje
migawkę, dzięki której panel wie, **co przyszło od ostatniego razu**. Nowe
pozycje dostają wtedy znacznik „nowe", a nad listą stoi data ostatniego
przebiegu.

Ta data jest ważniejsza, niż wygląda: gdy cron przestanie chodzić, zostaje
w miejscu i widać to od razu — zamiast dowiadywać się o awarii z tego, że
„jakoś nic nie przychodzi".

## Wpisy w cronie

Na VPS-ie, `crontab -e` (jako root):

```cron
# Zamówienia z Allegro — co pół godziny w godzinach pracy
0,30 8-17 * * *   /root/allegro-zamowienia.sh
# poza godzinami pracy raz na godzinę
0 0-7,18-23 * * * /root/allegro-zamowienia.sh
```

Godziny są **lokalne dla serwera**, więc przy zmianie czasu nic się nie
rozjeżdża — inaczej niż przy harmonogramie liczonym w UTC.

Zakres `8-17` z minutami `0,30` daje ostatni przebieg o **17:30**, a wpis
godzinowy łapie **18:00** i dalej. Razem wychodzi dokładnie „co 30 minut
od 8 do 18, potem co godzinę".

## Skrypt

`/root/allegro-zamowienia.sh`, prawa `chmod 700` — w środku jest token:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Ten sam token co CHANNEL_SYNC_TOKEN w /opt/marinero-frontend/.env.local
TOKEN="$(grep -m1 '^CHANNEL_SYNC_TOKEN=' /opt/marinero-frontend/.env.local | cut -d= -f2-)"

curl -fsS --max-time 60 -X POST \
  -H "x-sync-token: ${TOKEN}" \
  https://marinero.pl/api/kanaly/zamowienia/odswiez \
  >> /var/log/allegro-zamowienia.log 2>&1
```

Token czytamy z `.env.local`, zamiast wpisywać go drugi raz: jedno miejsce
na sekret to jedno miejsce do zmiany, gdy się go wymienia.

## Sprawdzenie

Ręcznie, od razu:

```bash
bash /root/allegro-zamowienia.sh && tail -3 /var/log/allegro-zamowienia.log
```

Poprawna odpowiedź to `{"ok":true,"ile":…,"nowe":…,"kiedy":"…"}`.

- `{"ok":false,"powod":"brak_kluczy_allegro"}` — brak `ALLEGRO_CLIENT_ID`
  albo `ALLEGRO_CLIENT_SECRET` w `.env.local`.
- `401 Brak dostępu` — token w skrypcie nie zgadza się z `CHANNEL_SYNC_TOKEN`.
- `503` — `CHANNEL_SYNC_TOKEN` w ogóle nie jest ustawiony, więc końcówka jest
  wyłączona. To celowo: bez tokenu każdy mógłby ją wywoływać.
- coś z `invalid_grant` — refresh token Allegro zużyty, trzeba przejść
  autoryzację od nowa (`node scripts/allegro/autoryzuj.mjs`).

**Pierwszy przebieg nie oznaczy niczego jako „nowe"** — dopiero drugi ma się
z czym porównać. Tak ma być: inaczej po włączeniu automatu zapaliłaby się cała
historia i znacznik przestałby cokolwiek znaczyć.
